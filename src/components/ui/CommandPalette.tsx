"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, TrendingUp, BarChart3, Settings, Zap, BookOpen, Activity } from "lucide-react";
import { useAppState } from "@/hooks/useAppState";
import { fetchWithRetry } from "@/lib/api-client";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: typeof Search;
  action: () => void;
  category: string;
}

interface StockSearchResult {
  code: string;
  name: string;
  market: string;
  type: string;
}

export default function CommandPalette() {
  const { selectedStock, setSelectedStock, watchlist } = useAppState();
  const { setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 命令列表
  const commands: CommandItem[] = [
    // 主题切换
    { id: "theme-dark", label: "切换到深色主题", description: "深色交易终端模式", icon: Settings, action: () => setTheme("dark"), category: "主题" },
    { id: "theme-light", label: "切换到浅色主题", description: "浅色明亮模式", icon: Settings, action: () => setTheme("light"), category: "主题" },
    { id: "theme-eyecare", label: "切换到护眼主题", description: "护眼绿色模式", icon: Settings, action: () => setTheme("eye-care"), category: "主题" },
    // 功能导航
    { id: "nav-analysis", label: "展开分析引擎", description: "展开所有分析面板", icon: BarChart3, action: () => document.querySelectorAll<HTMLButtonElement>('[data-accordion]').forEach(b => { if (!b.dataset.expanded) b.click(); }), category: "导航" },
    { id: "nav-collapse", label: "折叠所有面板", description: "折叠所有展开的面板", icon: BarChart3, action: () => document.querySelectorAll<HTMLButtonElement>('[data-accordion][data-expanded]').forEach(b => b.click()), category: "导航" },
    // 快捷操作
    { id: "action-refresh", label: "刷新数据", description: "重新获取当前股票数据", icon: Zap, action: () => window.location.reload(), category: "操作" },
  ];

  // 添加自选股到命令列表
  const stockCommands: CommandItem[] = watchlist.slice(0, 9).map((stock: { code: string; name: string }, i: number) => ({
    id: `stock-${stock.code}`,
    label: `切换到 ${stock.name}`,
    description: `${stock.code} · 快捷键 ${i + 1}`,
    icon: TrendingUp,
    action: () => setSelectedStock({ code: stock.code, name: stock.name, market: stock.code.startsWith('6') ? 'sh' : 'sz', type: 'stock' }),
    category: "自选股",
  }));

  const allCommands = [...stockCommands, ...commands];

  // 实时股票搜索（带防抖）
  useEffect(() => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    // 清除之前的定时器
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // 300ms 防抖
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchWithRetry(`/api/stock?action=search&keyword=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setSearchResults(data.data.slice(0, 10));
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // 合并搜索结果和命令
  const searchItems: CommandItem[] = searchResults.map(stock => ({
    id: `search-${stock.code}`,
    label: `${stock.name} (${stock.code})`,
    description: `${stock.market === 'sh' ? '沪' : '深'}市 · ${stock.type === 'stock' ? '股票' : '指数'}`,
    icon: TrendingUp,
    action: () => setSelectedStock({
      code: stock.code,
      name: stock.name,
      market: stock.market as 'sh' | 'sz' | 'bj',
      type: (stock.type || 'stock') as 'stock' | 'etf' | 'index',
    }),
    category: "搜索结果",
  }));

  // 过滤命令
  const filteredCommands = query
    ? allCommands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description.toLowerCase().includes(query.toLowerCase()) ||
        cmd.category.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands;

  const filtered = [...searchItems, ...filteredCommands];

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K 或 Cmd+K 打开命令面板
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Esc 关闭
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
      // 数字键 1-9 快速切换股票（仅在非输入状态下）
      if (!isOpen && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= watchlist.length) {
          const stock = watchlist[num - 1];
          setSelectedStock({ code: stock.code, name: stock.name, market: stock.code.startsWith('6') ? 'sh' : 'sz', type: 'stock' });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, watchlist, setSelectedStock]);

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
        setIsOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      
      {/* 命令面板 */}
      <div className="relative w-full max-w-lg bg-[#111827] border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        {/* 搜索框 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="输入股票代码/名称搜索，或输入命令..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
          />
          {isSearching && (
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-800 rounded">ESC</kbd>
        </div>

        {/* 命令列表 */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              未找到匹配的命令
            </div>
          ) : (
            <>
              {(() => {
                let lastCategory = "";
                return filtered.map((cmd, index) => {
                  const showCategory = cmd.category !== lastCategory;
                  lastCategory = cmd.category;
                  const Icon = cmd.icon;
                  return (
                    <div key={cmd.id}>
                      {showCategory && (
                        <div className="px-4 py-1 text-[10px] text-gray-500 uppercase tracking-wider">
                          {cmd.category}
                        </div>
                      )}
                      <button
                        onClick={() => { cmd.action(); setIsOpen(false); setQuery(""); }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${
                          index === selectedIndex ? "bg-blue-500/10" : "hover:bg-white/5"
                        }`}
                      >
                        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-200 truncate">{cmd.label}</div>
                          <div className="text-[10px] text-gray-500 truncate">{cmd.description}</div>
                        </div>
                      </button>
                    </div>
                  );
                });
              })()}
            </>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-gray-700 flex items-center gap-4 text-[10px] text-gray-500">
          <span>↑↓ 导航</span>
          <span>↵ 选择</span>
          <span>1-9 切换股票</span>
        </div>
      </div>
    </div>
  );
}
