"use client";

import { useState, useEffect } from 'react';
import { isTradingTime, getTradingStatus } from '@/lib/trading-time';

/**
 * 交易状态指示器组件
 * 显示当前A股交易状态（交易中/已休市）
 */
export function TradingStatusIndicator() {
  const [status, setStatus] = useState(getTradingStatus());
  const [isExpanded, setIsExpanded] = useState(false);

  // 每30秒更新一次状态
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getTradingStatus());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
          status.isTrading
            ? 'bg-green-500/20 text-[var(--accent-green)] border border-green-500/30'
            : 'bg-[var(--bg-card)]/50 text-[var(--text-secondary)] border border-[var(--border-default)]/30'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${
          status.isTrading ? 'bg-green-400 animate-pulse' : 'bg-[var(--text-secondary)]'
        }`} />
        <span>{status.statusText}</span>
      </button>

      {isExpanded && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)]">交易状态</span>
              <span className={`text-[10px] font-medium ${
                status.isTrading ? 'text-[var(--accent-green)]' : 'text-[var(--text-secondary)]'
              }`}>
                {status.statusText}
              </span>
            </div>
            
            {status.nextSession && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-secondary)]">下一时段</span>
                <span className="text-[10px] text-[var(--accent-blue)]">{status.nextSession}</span>
              </div>
            )}
            
            <div className="pt-2 border-t border-[var(--border-default)]">
              <div className="text-[9px] text-[var(--text-secondary)] space-y-1">
                <div>上午: 9:30 - 11:30</div>
                <div>下午: 13:00 - 15:00</div>
                <div className="text-[var(--text-muted)]">（工作日交易）</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 交易状态Hook
 * 返回当前交易状态和是否为交易时间
 */
export function useTradingStatus() {
  const [isTrading, setIsTrading] = useState(isTradingTime());
  const [status, setStatus] = useState(getTradingStatus());

  useEffect(() => {
    const updateStatus = () => {
      setIsTrading(isTradingTime());
      setStatus(getTradingStatus());
    };

    // 每30秒更新
    const interval = setInterval(updateStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { isTrading, status };
}
