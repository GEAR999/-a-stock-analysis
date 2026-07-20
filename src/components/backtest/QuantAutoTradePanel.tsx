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
      <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
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
    <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-[var(--text-primary)]">量化自动交易</span>
          {isRunning && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-green-500/20 text-[var(--accent-green)] border border-green-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              运行中
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowStrategyConfig(!showStrategyConfig)}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="策略配置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggleAutoTrade}
            className={`p-1.5 transition-colors ${isRunning ? 'text-[var(--accent-yellow)] hover:text-yellow-300' : 'text-[var(--accent-green)] hover:text-green-300'}`}
            title={isRunning ? '暂停' : '启动'}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDeleteAccount}
            className="p-1.5 text-[var(--accent-red)] hover:text-red-300 transition-colors"
            title="删除账户"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 策略概览 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">策略名称</span>
          <span className="text-[var(--text-primary)]">{strategy.name}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">运行模式</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
            account.runMode === 'backtest' ? 'bg-blue-500/20 text-[var(--accent-blue)]' : 'bg-red-500/20 text-[var(--accent-red)]'
          }`}>
            {account.runMode === 'backtest' ? '📊 历史回测' : '🔴 实时验证'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">跟踪股票</span>
          <span className="text-[var(--text-primary)]">{account.trackingList.length}只</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">单股最大仓位</span>
          <span className="text-[var(--text-primary)]">{strategy.maxPositionPercent}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">交易时段</span>
          <span className={isTradingTime(runMode) ? 'text-[var(--accent-green)]' : 'text-[var(--text-secondary)]'}>
            {isTradingTime(runMode) ? '交易中' : '已休市'}
          </span>
        </div>
      </div>

      {/* 策略配置面板 */}
      {showStrategyConfig && (
        <div className="mt-3 pt-3 border-t border-[var(--border-default)] space-y-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)]">策略名称</label>
            <input
              type="text"
              value={strategy.name}
              onChange={(e) => handleUpdateStrategy({ name: e.target.value })}
              className="w-full mt-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">单股最大仓位 (%)</label>
            <input
              type="number"
              value={strategy.maxPositionPercent}
              onChange={(e) => handleUpdateStrategy({ maxPositionPercent: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">止损比例 (%)</label>
            <input
              type="number"
              value={strategy.stopLossPercent}
              onChange={(e) => handleUpdateStrategy({ stopLossPercent: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">止盈比例 (%)</label>
            <input
              type="number"
              value={strategy.takeProfitPercent}
              onChange={(e) => handleUpdateStrategy({ takeProfitPercent: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
            />
          </div>

          {/* AI辅助判断配置 */}
          <div className="pt-3 border-t border-[var(--border-default)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <label className="text-xs text-[var(--text-primary)]">AI辅助判断</label>
              </div>
              <button
                onClick={() => handleUpdateStrategy({ aiEnabled: !strategy.aiEnabled })}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  strategy.aiEnabled ? 'bg-purple-500' : 'bg-[var(--bg-card)]'
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
                  <label className="text-[10px] text-[var(--text-secondary)]">AI适配器</label>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => handleUpdateStrategy({ aiType: 'rule-based' })}
                      className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors ${
                        strategy.aiType === 'rule-based'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      规则增强
                    </button>
                    <button
                      disabled
                      className="flex-1 px-2 py-1.5 text-[10px] rounded border border-[var(--border-default)] bg-[var(--bg-card)]/30 text-[var(--text-muted)] cursor-not-allowed relative"
                    >
                      🌐 API接口
                      <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[8px] bg-[var(--bg-card)] text-[var(--text-secondary)] rounded">
                        即将推出
                      </span>
                    </button>
                  </div>
                </div>

                {/* AI权重配置 */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-[var(--text-secondary)]">AI权重占比</label>
                    <span className="text-[10px] text-purple-400 font-mono">{strategy.aiWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={strategy.aiWeight}
                    onChange={(e) => handleUpdateStrategy({ aiWeight: Number(e.target.value) })}
                    className="w-full mt-1 h-1 bg-[var(--bg-card)] rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-0.5">
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
