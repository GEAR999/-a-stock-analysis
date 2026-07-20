'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { StockInfo, StockQuote, WatchlistItem, AnalysisSettings, ChatMessage, KLineData, KLinePeriod } from '@/lib/types';
import { fetchWithRetry, onOnlineStatusChange } from '@/lib/api-client';

interface AppState {
  // Stock
  selectedStock: StockInfo | null;
  currentQuote: StockQuote | null;
  watchlist: WatchlistItem[];
  searchResults: StockInfo[];
  isMonitoring: boolean;

  // K-line
  klinePeriod: KLinePeriod;
  klineData: KLineData[];

  // Analysis
  analysisSettings: AnalysisSettings;

  // AI
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
  chatMode: 'analysis' | 'debug';

  // Actions
  setSelectedStock: (stock: StockInfo | null) => void;
  addToWatchlist: (stock: StockInfo) => void;
  removeFromWatchlist: (code: string) => void;
  reorderWatchlist: (fromIndex: number, toIndex: number) => void;
  setSearchResults: (results: StockInfo[]) => void;
  setIsMonitoring: (v: boolean) => void;
  setKlinePeriod: (p: KLinePeriod) => void;
  setKlineData: (data: KLineData[]) => void;
  setAnalysisSettings: (s: Partial<AnalysisSettings>) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setIsChatOpen: (v: boolean) => void;
  setChatMode: (m: 'analysis' | 'debug') => void;
  searchStocks: (keyword: string) => Promise<void>;
  refreshQuote: () => Promise<void>;
}

const defaultAnalysisSettings: AnalysisSettings = {
  chanlun: true,
  wave: false,
  technical: true,
  macd: true,
  kdj: false,
  rsi: false,
  boll: false,
  ma: true,
  maPeriods: [5, 10, 20, 60],
  waveSensitivity: 'medium',
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
  const [currentQuote, setCurrentQuote] = useState<StockQuote | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [klinePeriod, setKlinePeriod] = useState<KLinePeriod>('daily');
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [analysisSettings, setAnalysisSettingsState] = useState<AnalysisSettings>(defaultAnalysisSettings);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'analysis' | 'debug'>('analysis');

  // localStorage 安全写入工具
  const safeSetItem = useCallback((key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('[AppState] localStorage 存储空间不足，尝试清理旧缓存...');
        // 清理最旧的缓存数据
        try {
          const keysToCheck = ['stock-kline-cache', 'stock-chat-messages', 'score-history'];
          for (const k of keysToCheck) {
            localStorage.removeItem(k);
          }
          // 重试写入
          localStorage.setItem(key, JSON.stringify(value));
        } catch {
          console.error('[AppState] 清理后仍无法写入，放弃保存:', key);
        }
      } else {
        console.warn('[AppState] localStorage 写入失败:', key, e);
      }
    }
  }, []);

  // 带版本标记的状态读取
  const safeGetItem = useCallback(<T,>(key: string, fallback: T, version?: number): T => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      // 版本检查
      if (version !== undefined && parsed._version !== undefined && parsed._version !== version) {
        console.warn(`[AppState] ${key} 版本不匹配 (${parsed._version} → ${version})，使用默认值`);
        return fallback;
      }
      return parsed._version !== undefined ? parsed.data : parsed;
    } catch {
      console.warn(`[AppState] ${key} 解析失败，使用默认值`);
      return fallback;
    }
  }, []);

  // Load watchlist and chat from localStorage
  useEffect(() => {
    const savedWatchlist = safeGetItem<WatchlistItem[]>('stock-watchlist', []);
    if (savedWatchlist.length > 0) setWatchlist(savedWatchlist);
    const savedChat = safeGetItem<ChatMessage[]>('stock-chat-messages', []);
    if (savedChat.length > 0) setChatMessages(savedChat);
  }, [safeGetItem]);

  // Save watchlist to localStorage (with version)
  useEffect(() => {
    safeSetItem('stock-watchlist', { _version: 1, data: watchlist });
  }, [watchlist, safeSetItem]);

  // Save chat to localStorage (with version)
  useEffect(() => {
    safeSetItem('stock-chat-messages', { _version: 1, data: chatMessages });
  }, [chatMessages, safeSetItem]);

  // 多标签页同步：监听 storage 事件
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'stock-watchlist' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const data = parsed._version !== undefined ? parsed.data : parsed;
          if (Array.isArray(data)) {
            setWatchlist(data);
          }
        } catch { /* ignore */ }
      }
      if (e.key === 'stock-chat-messages' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const data = parsed._version !== undefined ? parsed.data : parsed;
          if (Array.isArray(data)) {
            setChatMessages(data);
          }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const searchStocksAction = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetchWithRetry(`/api/stock?action=search&keyword=${encodeURIComponent(keyword)}`);
      const json = await res.json();
      if (json.success) setSearchResults(json.data);
      else setSearchResults([]);
    } catch {
      setSearchResults([]);
    }
  }, []);

  const refreshQuote = useCallback(async () => {
    if (!selectedStock) return;
    try {
      const res = await fetchWithRetry(`/api/stock?action=quote&code=${selectedStock.code}`);
      const json = await res.json();
      if (json.success) setCurrentQuote(json.data);
    } catch {
      // ignore
    }
  }, [selectedStock]);

  // Auto refresh quote
  useEffect(() => {
    if (!isMonitoring || !selectedStock) return;
    const interval = setInterval(() => {
      refreshQuote();
    }, 5000);
    return () => clearInterval(interval);
  }, [isMonitoring, selectedStock, refreshQuote]);

  // Fetch initial quote when stock changes
  useEffect(() => {
    if (!selectedStock) {
      setCurrentQuote(null);
      return;
    }
    refreshQuote();
  }, [selectedStock, refreshQuote]);

  const addToWatchlist = useCallback((stock: StockInfo) => {
    setWatchlist(prev => {
      if (prev.some(w => w.code === stock.code)) return prev;
      return [...prev, { code: stock.code, name: stock.name, market: stock.market, order: prev.length }];
    });
  }, []);

  const removeFromWatchlist = useCallback((code: string) => {
    setWatchlist(prev => prev.filter(w => w.code !== code));
  }, []);

  const reorderWatchlist = useCallback((fromIndex: number, toIndex: number) => {
    setWatchlist(prev => {
      const newList = [...prev];
      const [moved] = newList.splice(fromIndex, 1);
      newList.splice(toIndex, 0, moved);
      return newList.map((item, i) => ({ ...item, order: i }));
    });
  }, []);

  const setAnalysisSettings = useCallback((partial: Partial<AnalysisSettings>) => {
    setAnalysisSettingsState(prev => ({ ...prev, ...partial }));
  }, []);

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setChatMessages(prev => [...prev, msg]);
  }, []);

  return (
    <AppContext.Provider value={{
      selectedStock, currentQuote, watchlist, searchResults, isMonitoring,
      klinePeriod, klineData, analysisSettings, chatMessages, isChatOpen, chatMode,
      setSelectedStock, addToWatchlist, removeFromWatchlist, reorderWatchlist,
      setSearchResults, setIsMonitoring, setKlinePeriod, setKlineData,
      setAnalysisSettings, addChatMessage, setIsChatOpen, setChatMode,
      searchStocks: searchStocksAction, refreshQuote,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
