'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppState } from '@/hooks/useAppState';
import type { StockInfo } from '@/lib/types';

export function StockSearch() {
  const { searchStocks, searchResults, addToWatchlist, setSelectedStock } = useAppState();
  const [keyword, setKeyword] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    setKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchStocks(value);
    }, 300);
  };

  const handleSelect = (stock: StockInfo) => {
    setSelectedStock(stock);
    setKeyword('');
    setIsFocused(false);
  };

  const handleAdd = (e: React.MouseEvent, stock: StockInfo) => {
    e.stopPropagation();
    addToWatchlist(stock);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#111827] border border-[#1e293b] rounded">
        <svg className="w-4 h-4 text-[#94a3b8] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="输入代码/名称搜索"
          className="w-full bg-transparent text-sm text-[#e2e8f0] placeholder-[#94a3b8] outline-none"
        />
      </div>

      {isFocused && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#111827] border border-[#1e293b] rounded shadow-lg z-50 max-h-64 overflow-y-auto">
          {searchResults.map((stock) => (
            <div
              key={`${stock.market}-${stock.code}`}
              onClick={() => handleSelect(stock)}
              className="flex items-center justify-between px-3 py-2 hover:bg-[#1e293b] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#e2e8f0]">{stock.name}</span>
                <span className="text-xs text-[#94a3b8] font-mono-num">{stock.code}</span>
              </div>
              <button
                onClick={(e) => handleAdd(e, stock)}
                className="text-xs text-[#3b82f6] hover:text-[#60a5fa] px-1"
                title="添加到自选"
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
