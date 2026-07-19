'use client';

import { useAppState } from '@/hooks/useAppState';
import { useRef, useState } from 'react';

export function WatchList() {
  const { watchlist, removeFromWatchlist, reorderWatchlist, setSelectedStock, selectedStock, currentQuote } = useAppState();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragItem.current !== null && dragItem.current !== index) {
      reorderWatchlist(dragItem.current, index);
    }
    dragItem.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  if (watchlist.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-[#94a3b8]">
        搜索股票并添加到自选
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {watchlist.map((item, index) => {
        const isSelected = selectedStock?.code === item.code;
        const isDragging = dragIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={item.code}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            onClick={() => setSelectedStock({ code: item.code, name: item.name, market: item.market, type: 'stock' })}
            className={`
              flex items-center justify-between px-3 py-2 cursor-pointer transition-all
              ${isSelected ? 'bg-[#1e293b] border-l-2 border-l-[#3b82f6]' : 'hover:bg-[#1e293b]/50 border-l-2 border-l-transparent'}
              ${isDragging ? 'opacity-50' : ''}
              ${isDragOver ? 'border-t-2 border-t-[#3b82f6]' : ''}
            `}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm text-[#e2e8f0] truncate">{item.name}</span>
              </div>
              <span className="text-xs text-[#94a3b8] font-mono-num">{item.code}</span>
            </div>
            <div className="flex items-center gap-2">
              {currentQuote && selectedStock?.code === item.code && (
                <span className={`text-xs font-mono-num ${
                  currentQuote.changePercent > 0 ? 'text-[#ef4444]' :
                  currentQuote.changePercent < 0 ? 'text-[#22c55e]' : 'text-[#94a3b8]'
                }`}>
                  {currentQuote.changePercent > 0 ? '+' : ''}{currentQuote.changePercent.toFixed(2)}%
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeFromWatchlist(item.code); }}
                className="text-[#94a3b8] hover:text-[#ef4444] text-xs p-1 transition-colors"
                title="删除"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
