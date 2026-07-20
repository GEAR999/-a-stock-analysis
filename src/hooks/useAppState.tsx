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

  // Load watchlist and chat from localStorage
  useEffect(() => {
    try {
      const savedWatchlist = localStorage.getItem('stock-watchlist');
      if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
      const savedChat = localStorage.getItem('stock-chat-messages');
      if (savedChat) setChatMessages(JSON.parse(savedChat));
    } catch {
      // ignore
    }
  }, []);

  // Save watchlist to localStorage
  useEffect(() => {
    localStorage.setItem('stock-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Save chat to localStorage
  useEffect(() => {
    localStorage.setItem('stock-chat-messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

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
