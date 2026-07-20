import { useState } from 'react';
import { Bot, Settings, Play, Pause, Trash2, Brain, Sparkles } from 'lucide-react';
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

  const runMode = account.runMode || 'realtime';
  const tradingActive = isTradingTime(runMode);

  const handleToggleAutoTrade = () => {
    if (!tradingActive) {
      onToast('warning', runMode === 'backtest' ? '回测模式不受交易时间限制' : '当前非交易时段，自动交易已暂停');
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
        aiEnabled: account.strategy?.aiEnabled || false,
        aiType: account.strategy?.aiType || 'rule-based',
        aiWeight: account.strategy?.aiWeight ?? 20,
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
          <span className="text-gray-500">运行模式</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
            account.runMode === 'backtest' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {account.runMode === 'backtest' ? '📊 历史回测' : '🔴 实时验证'}
          </span>
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
          <span className={isTradingTime(runMode) ? 'text-green-400' : 'text-gray-500'}>
            {isTradingTime(runMode) ? '交易中' : '已休市'}
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

          {/* AI辅助判断配置 */}
          <div className="pt-3 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <label className="text-xs text-gray-300">AI辅助判断</label>
              </div>
              <button
                onClick={() => handleUpdateStrategy({ aiEnabled: !strategy.aiEnabled })}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  strategy.aiEnabled ? 'bg-purple-500' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  strategy.aiEnabled ? 'translate-x-4' : ''
                }`} />
              </button>
            </div>

            {strategy.aiEnabled && (
              <div className="mt-3 space-y-3 pl-5">
                {/* AI适配器选择 */}
                <div>
                  <label className="text-[10px] text-gray-500">AI适配器</label>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => handleUpdateStrategy({ aiType: 'rule-based' })}
                      className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors ${
                        strategy.aiType === 'rule-based'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      规则增强
                    </button>
                    <button
                      disabled
                      className="flex-1 px-2 py-1.5 text-[10px] rounded border border-gray-800 bg-gray-800/30 text-gray-600 cursor-not-allowed relative"
                    >
                      🌐 API接口
                      <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[8px] bg-gray-700 text-gray-400 rounded">
                        即将推出
                      </span>
                    </button>
                  </div>
                </div>

                {/* AI权重配置 */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-500">AI权重占比</label>
                    <span className="text-[10px] text-purple-400 font-mono">{strategy.aiWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={strategy.aiWeight}
                    onChange={(e) => handleUpdateStrategy({ aiWeight: Number(e.target.value) })}
                    className="w-full mt-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
