'use client';

import { useState, useEffect } from 'react';
import { getMarketIndices, type MarketIndex } from '@/lib/api/stock';

export function MarketIndexTicker() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const data = await getMarketIndices();
        setIndices(data);
      } catch (err) {
        console.error('Failed to fetch market indices:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchIndices();
    // Refresh every 30 seconds
    const interval = setInterval(fetchIndices, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && indices.length === 0) {
    return (
      <div className="h-8 bg-[#0d1117] border-b border-gray-800 flex items-center px-4 gap-6">
        <div className="animate-pulse flex gap-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-4 w-24 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-8 bg-[#0d1117] border-b border-gray-800 flex items-center px-4 gap-6 overflow-x-auto scrollbar-hide">
      {indices.map((index) => {
        const isUp = index.changePercent > 0;
        const isDown = index.changePercent < 0;
        const colorClass = isUp ? 'text-red-500' : isDown ? 'text-green-500' : 'text-gray-400';
        
        return (
          <div key={index.code} className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            <span className="text-gray-400 text-xs">{index.name}</span>
            <span className={`text-xs font-mono font-medium ${colorClass}`}>
              {index.price.toFixed(2)}
            </span>
            <span className={`text-xs font-mono ${colorClass}`}>
              {isUp ? '+' : ''}{index.changePercent.toFixed(2)}%
            </span>
          </div>
        );
      })}
      {indices.length === 0 && (
        <span className="text-gray-500 text-xs">暂无指数数据</span>
      )}
    </div>
  );
}
