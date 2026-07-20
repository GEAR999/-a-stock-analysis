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
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${
          status.isTrading ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
        }`} />
        <span>{status.statusText}</span>
      </button>

      {isExpanded && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-[#111827] border border-gray-700 rounded-lg shadow-lg z-50 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">交易状态</span>
              <span className={`text-[10px] font-medium ${
                status.isTrading ? 'text-green-400' : 'text-gray-400'
              }`}>
                {status.statusText}
              </span>
            </div>
            
            {status.nextSession && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">下一时段</span>
                <span className="text-[10px] text-blue-400">{status.nextSession}</span>
              </div>
            )}
            
            <div className="pt-2 border-t border-gray-700">
              <div className="text-[9px] text-gray-500 space-y-1">
                <div>上午: 9:30 - 11:30</div>
                <div>下午: 13:00 - 15:00</div>
                <div className="text-gray-600">（工作日交易）</div>
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
