import { useState } from 'react';
import { Bot, Settings, Play, Pause, Trash2 } from 'lucide-react';
import type { Account, QuantStrategy, StrategySource } from './types';
import { saveAccount, deleteAccount } from './storage';
import { formatMoney } from './utils';
import { isTradingTime } from '@/lib/trading-time';

interface QuantAutoTradePanelProps {
  account: Account;
  stockCode: string;
  stockName: string;
  onUpdate: (updated: Account | null) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function QuantAutoTradePanel({ account, stockCode, stockName, onUpdate, onToast }: QuantAutoTradePanelProps) {
  const [showStrategyConfig, setShowStrategyConfig] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const strategy = account.strategy;

  if (!strategy) {
    return (
      <div className="bg-[#111827] rounded border border-gray-800 p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Bot className="w-4 h-4" />
          <span className="text-sm">此账户未配置量化策略</span>
        </div>
      </div>
    );
  }

  const handleToggleAutoTrade = () => {
    if (!isTradingTime()) {
      onToast('warning', '当前非交易时段，自动交易已暂停');
      return;
    }
    setIsRunning(!isRunning);
    onToast('info', isRunning ? '自动交易已暂停' : '自动交易已启动');
  };

  const handleDeleteAccount = () => {
    if (confirm(`确定要删除账户 "${account.name}" 吗？此操作不可恢复。`)) {
      deleteAccount(account.id);
      onUpdate(null);
      onToast('success', `账户 ${account.name} 已删除`);
    }
  };

  const handleUpdateStrategy = (updates: Partial<QuantStrategy>) => {
    const updatedAccount: Account = {
      ...account,
      strategy: { 
        name: account.strategy?.name || '默认策略',
        theories: account.strategy?.theories || ['technical'] as StrategySource[],
        stopLossPercent: account.strategy?.stopLossPercent || 5,
        takeProfitPercent: account.strategy?.takeProfitPercent || 10,
        maxPositionPercent: account.strategy?.maxPositionPercent || 20,
        autoTrade: account.strategy?.autoTrade || false,
        ...updates 
      },
    };
    saveAccount(updatedAccount);
    onUpdate(updatedAccount);
  };

  return (
    <div className="bg-[#111827] rounded border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-gray-200">量化自动交易</span>
          {isRunning && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              运行中
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowStrategyConfig(!showStrategyConfig)}
            className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
            title="策略配置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggleAutoTrade}
            className={`p-1.5 transition-colors ${isRunning ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'}`}
            title={isRunning ? '暂停' : '启动'}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDeleteAccount}
            className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
            title="删除账户"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 策略概览 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">策略名称</span>
          <span className="text-gray-200">{strategy.name}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">跟踪股票</span>
          <span className="text-gray-200">{account.trackingList.length}只</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">单股最大仓位</span>
          <span className="text-gray-200">{strategy.maxPositionPercent}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">交易时段</span>
          <span className={isTradingTime() ? 'text-green-400' : 'text-gray-500'}>
            {isTradingTime() ? '交易中' : '已休市'}
          </span>
        </div>
      </div>

      {/* 策略配置面板 */}
      {showStrategyConfig && (
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
          <div>
            <label className="text-xs text-gray-500">策略名称</label>
            <input
              type="text"
              value={strategy.name}
              onChange={(e) => handleUpdateStrategy({ name: e.target.value })}
              className="w-full mt-1 px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">单股最大仓位 (%)</label>
            <input
              type="number"
              value={strategy.maxPositionPercent}
              onChange={(e) => handleUpdateStrategy({ maxPositionPercent: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">止损比例 (%)</label>
            <input
              type="number"
              value={strategy.stopLossPercent}
              onChange={(e) => handleUpdateStrategy({ stopLossPercent: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">止盈比例 (%)</label>
            <input
              type="number"
              value={strategy.takeProfitPercent}
              onChange={(e) => handleUpdateStrategy({ takeProfitPercent: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200"
            />
          </div>
        </div>
      )}
    </div>
  );
}
