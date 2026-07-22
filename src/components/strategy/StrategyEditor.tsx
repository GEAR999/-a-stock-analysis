'use client';

import { useState, useMemo } from 'react';
import { X, Save, Signal, Shield, Wallet, Settings2, Info } from 'lucide-react';
import type { StrategyType, SignalConfig, PositionControl, RiskControl, CostConfig } from '@/lib/backtest-engine';
import {
  DEFAULT_POSITION_CONTROL, DEFAULT_RISK_CONTROL, DEFAULT_COST_CONFIG,
} from '@/lib/backtest-engine';
import {
  generateStrategyId, saveCustomStrategy,
  type StrategyDefinition, type StrategyCategory,
} from '@/lib/strategy-library';

// ============ 信号选项 ============

interface SignalOption {
  value: StrategyType;
  label: string;
  group: 'tech' | 'engine';
  direction: 'buy' | 'sell';
}

const SIGNAL_OPTIONS: SignalOption[] = [
  { value: 'macd_golden_cross', label: 'MACD金叉', group: 'tech', direction: 'buy' },
  { value: 'macd_death_cross', label: 'MACD死叉', group: 'tech', direction: 'sell' },
  { value: 'kdj_oversold', label: 'KDJ超卖', group: 'tech', direction: 'buy' },
  { value: 'kdj_overbought', label: 'KDJ超买', group: 'tech', direction: 'sell' },
  { value: 'rsi_oversold', label: 'RSI超卖', group: 'tech', direction: 'buy' },
  { value: 'rsi_overbought', label: 'RSI超买', group: 'tech', direction: 'sell' },
  { value: 'boll_lower_touch', label: '触及布林下轨', group: 'tech', direction: 'buy' },
  { value: 'boll_upper_touch', label: '触及布林上轨', group: 'tech', direction: 'sell' },
  { value: 'ma_golden_cross', label: '均线金叉', group: 'tech', direction: 'buy' },
  { value: 'ma_death_cross', label: '均线死叉', group: 'tech', direction: 'sell' },
  { value: 'chanlun_buy', label: '缠论买点', group: 'engine', direction: 'buy' },
  { value: 'chanlun_sell', label: '缠论卖点', group: 'engine', direction: 'sell' },
  { value: 'wave_buy', label: '波浪起点', group: 'engine', direction: 'buy' },
  { value: 'wave_sell', label: '波浪终点', group: 'engine', direction: 'sell' },
  { value: 'tech_resonance_buy', label: '多指标共振买', group: 'engine', direction: 'buy' },
  { value: 'tech_resonance_sell', label: '多指标共振卖', group: 'engine', direction: 'sell' },
];

// ============ 类型 ============

type EditorMode = 'create' | 'edit' | 'view';
type EditorTab = 'basic' | 'signal' | 'position' | 'risk' | 'cost';

interface StrategyEditorProps {
  strategy?: StrategyDefinition;
  mode: EditorMode;
  onSave: () => void;
  onCancel: () => void;
}

// ============ 辅助组件 ============

function SliderInput({
  label, value, onChange, min, max, step, format, disabled, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-secondary">{label}</span>
        <span className="text-[11px] text-text-primary font-mono">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1 bg-border-subtle rounded-lg appearance-none cursor-pointer accent-accent-blue disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {hint && <div className="text-[9px] text-text-muted">{hint}</div>}
    </div>
  );
}

function ToggleInput({
  label, value, onChange, disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <button
        onClick={() => !disabled && onChange(!value)}
        className={`relative w-8 h-4 rounded-full transition-colors ${value ? 'bg-accent-blue' : 'bg-border-strong'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

// ============ 主组件 ============

export function StrategyEditor({ strategy, mode, onSave, onCancel }: StrategyEditorProps) {
  const isReadonly = mode === 'view';
  const isBuiltin = strategy?.id.startsWith('builtin_') ?? false;
  const readonly_ = isReadonly || isBuiltin;

  const [activeTab, setActiveTab] = useState<EditorTab>('basic');
  const [name, setName] = useState(strategy?.name ?? '');
  const [description, setDescription] = useState(strategy?.description ?? '');
  const [category] = useState<StrategyCategory>(strategy?.category ?? 'custom');

  // Signal config
  const [signals, setSignals] = useState<SignalConfig>(strategy?.signals ?? {
    buySignals: [],
    sellSignals: [],
    buyLogic: 'OR',
    sellLogic: 'OR',
    minBuyMatch: 1,
    minSellMatch: 1,
  });

  // Position config
  const [position, setPosition] = useState<PositionControl>(strategy?.position ?? { ...DEFAULT_POSITION_CONTROL });

  // Risk config
  const [risk, setRisk] = useState<RiskControl>(strategy?.risk ?? { ...DEFAULT_RISK_CONTROL });

  // Cost config
  const [cost, setCost] = useState<CostConfig>(strategy?.cost ?? { ...DEFAULT_COST_CONFIG });

  // ============ 信号操作 ============

  const toggleSignal = (sig: StrategyType) => {
    if (readonly_) return;
    const opt = SIGNAL_OPTIONS.find(o => o.value === sig);
    if (!opt) return;

    if (opt.direction === 'buy') {
      setSignals(prev => ({
        ...prev,
        buySignals: prev.buySignals.includes(sig)
          ? prev.buySignals.filter(s => s !== sig)
          : [...prev.buySignals, sig],
      }));
    } else {
      setSignals(prev => ({
        ...prev,
        sellSignals: prev.sellSignals.includes(sig)
          ? prev.sellSignals.filter(s => s !== sig)
          : [...prev.sellSignals, sig],
      }));
    }
  };

  const signalLabel = useMemo(() => {
    const map = new Map(SIGNAL_OPTIONS.map(o => [o.value, o.label]));
    return map;
  }, []);

  // ============ 保存 ============

  const handleSave = () => {
    if (!name.trim()) return;
    if (signals.buySignals.length === 0 && signals.sellSignals.length === 0) return;

    const now = new Date().toISOString();
    const def: StrategyDefinition = {
      id: strategy?.id ?? generateStrategyId(),
      name: name.trim(),
      description: description.trim(),
      category,
      signals,
      position,
      risk,
      cost,
      isFavorite: strategy?.isFavorite ?? false,
      usageCount: strategy?.usageCount ?? 0,
      lastUsedAt: strategy?.lastUsedAt,
      createdAt: strategy?.createdAt ?? now,
      updatedAt: now,
    };

    saveCustomStrategy(def);
    onSave();
  };

  // ============ Tab配置 ============

  const tabs: { key: EditorTab; label: string; icon: typeof Signal }[] = [
    { key: 'basic', label: '基本信息', icon: Info },
    { key: 'signal', label: '信号', icon: Signal },
    { key: 'position', label: '仓位', icon: Wallet },
    { key: 'risk', label: '风控', icon: Shield },
    { key: 'cost', label: '成本', icon: Settings2 },
  ];

  // ============ 渲染 ============

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[520px] max-h-[85vh] flex flex-col bg-[#111827] border border-border-strong rounded shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h3 className="text-sm font-bold text-text-primary">
            {mode === 'create' ? '新建策略' : mode === 'edit' ? '编辑策略' : '查看策略'}
          </h3>
          <button onClick={onCancel} className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-surface-raised">
            <X size={16} />
          </button>
        </div>

        {/* Tab栏 */}
        <div className="flex border-b border-border-subtle px-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const hasWarning = tab.key === 'signal' && signals.buySignals.length === 0 && signals.sellSignals.length === 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 px-3 py-2 text-[11px] border-b-2 transition-colors ${
                  isActive
                    ? 'text-accent-blue border-accent-blue'
                    : 'text-text-secondary hover:text-text-primary border-transparent'
                }`}
              >
                <Icon size={12} />
                {tab.label}
                {hasWarning && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              </button>
            );
          })}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
          {/* 基本信息 */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-text-secondary mb-1 block">策略名称 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={readonly_}
                  placeholder="输入策略名称"
                  className="w-full px-3 py-1.5 text-xs bg-surface-input border border-border-subtle rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[11px] text-text-secondary mb-1 block">策略描述</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={readonly_}
                  placeholder="描述策略的核心逻辑和适用场景"
                  rows={3}
                  className="w-full px-3 py-1.5 text-xs bg-surface-input border border-border-subtle rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue resize-none disabled:opacity-50"
                />
              </div>
              {/* 预览摘要 */}
              <div className="bg-surface-raised rounded p-3 space-y-2">
                <div className="text-[10px] text-text-secondary font-medium">策略摘要</div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-text-muted">买入信号: </span>
                    <span className="text-text-primary">
                      {signals.buySignals.length > 0
                        ? signals.buySignals.map(s => signalLabel.get(s) || s).join(', ')
                        : '未配置'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">卖出信号: </span>
                    <span className="text-text-primary">
                      {signals.sellSignals.length > 0
                        ? signals.sellSignals.map(s => signalLabel.get(s) || s).join(', ')
                        : '未配置'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">止损: </span>
                    <span className="text-text-primary">{risk.stopLoss > 0 ? `${(risk.stopLoss * 100).toFixed(1)}%` : '无'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">止盈: </span>
                    <span className="text-text-primary">{risk.takeProfit > 0 ? `${(risk.takeProfit * 100).toFixed(1)}%` : '无'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">最大仓位: </span>
                    <span className="text-text-primary">{(position.maxTotalPosition * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-text-muted">手续费: </span>
                    <span className="text-text-primary">{(cost.commission * 10000).toFixed(1)}万</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 信号配置 */}
          {activeTab === 'signal' && (
            <div className="space-y-4">
              {/* 买入信号 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-text-secondary font-medium text-accent-red">买入信号</span>
                  <span className="text-[10px] text-text-muted">已选 {signals.buySignals.length} 个</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SIGNAL_OPTIONS.filter(o => o.direction === 'buy').map(opt => {
                    const selected = signals.buySignals.includes(opt.value);
                    const isEngine = opt.group === 'engine';
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleSignal(opt.value)}
                        disabled={readonly_}
                        className={`px-2 py-1 text-[10px] rounded transition-colors border ${
                          selected
                            ? isEngine
                              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                              : 'bg-accent-red/15 text-accent-red border-accent-red/30'
                            : 'bg-surface-input text-text-secondary border-border-subtle hover:border-border-strong hover:text-text-primary'
                        } ${readonly_ ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 卖出信号 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-text-secondary font-medium text-accent-green">卖出信号</span>
                  <span className="text-[10px] text-text-muted">已选 {signals.sellSignals.length} 个</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SIGNAL_OPTIONS.filter(o => o.direction === 'sell').map(opt => {
                    const selected = signals.sellSignals.includes(opt.value);
                    const isEngine = opt.group === 'engine';
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleSignal(opt.value)}
                        disabled={readonly_}
                        className={`px-2 py-1 text-[10px] rounded transition-colors border ${
                          selected
                            ? isEngine
                              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                              : 'bg-accent-green/15 text-accent-green border-accent-green/30'
                            : 'bg-surface-input text-text-secondary border-border-subtle hover:border-border-strong hover:text-text-primary'
                        } ${readonly_ ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 信号逻辑 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-text-secondary mb-1.5 block">买入逻辑</label>
                  <div className="flex gap-1">
                    {(['AND', 'OR'] as const).map(logic => (
                      <button
                        key={logic}
                        onClick={() => !readonly_ && setSignals(prev => ({ ...prev, buyLogic: logic }))}
                        disabled={readonly_}
                        className={`flex-1 py-1 text-[10px] rounded transition-colors ${
                          signals.buyLogic === logic
                            ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                            : 'bg-surface-input text-text-secondary border border-border-subtle'
                        } ${readonly_ ? 'cursor-default' : ''}`}
                      >
                        {logic === 'AND' ? '全部满足 (AND)' : '任一满足 (OR)'}
                      </button>
                    ))}
                  </div>
                  {signals.buySignals.length > 1 && (
                    <div className="mt-1.5">
                      <label className="text-[10px] text-text-muted mb-1 block">最少匹配数</label>
                      <input
                        type="number"
                        min={1}
                        max={signals.buySignals.length}
                        value={signals.minBuyMatch}
                        onChange={e => setSignals(prev => ({ ...prev, minBuyMatch: Math.min(Number(e.target.value) || 1, prev.buySignals.length) }))}
                        disabled={readonly_}
                        className="w-full px-2 py-1 text-[10px] bg-surface-input border border-border-subtle rounded text-text-primary focus:outline-none focus:border-accent-blue disabled:opacity-50"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-text-secondary mb-1.5 block">卖出逻辑</label>
                  <div className="flex gap-1">
                    {(['AND', 'OR'] as const).map(logic => (
                      <button
                        key={logic}
                        onClick={() => !readonly_ && setSignals(prev => ({ ...prev, sellLogic: logic }))}
                        disabled={readonly_}
                        className={`flex-1 py-1 text-[10px] rounded transition-colors ${
                          signals.sellLogic === logic
                            ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                            : 'bg-surface-input text-text-secondary border border-border-subtle'
                        } ${readonly_ ? 'cursor-default' : ''}`}
                      >
                        {logic === 'AND' ? '全部满足 (AND)' : '任一满足 (OR)'}
                      </button>
                    ))}
                  </div>
                  {signals.sellSignals.length > 1 && (
                    <div className="mt-1.5">
                      <label className="text-[10px] text-text-muted mb-1 block">最少匹配数</label>
                      <input
                        type="number"
                        min={1}
                        max={signals.sellSignals.length}
                        value={signals.minSellMatch}
                        onChange={e => setSignals(prev => ({ ...prev, minSellMatch: Math.min(Number(e.target.value) || 1, prev.sellSignals.length) }))}
                        disabled={readonly_}
                        className="w-full px-2 py-1 text-[10px] bg-surface-input border border-border-subtle rounded text-text-primary focus:outline-none focus:border-accent-blue disabled:opacity-50"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 仓位控制 */}
          {activeTab === 'position' && (
            <div className="space-y-4">
              <SliderInput
                label="总仓位上限"
                value={position.maxTotalPosition}
                onChange={v => setPosition(prev => ({ ...prev, maxTotalPosition: v }))}
                min={0.1} max={1} step={0.05}
                format={v => `${(v * 100).toFixed(0)}%`}
                disabled={readonly_}
                hint="账户最多使用的资金比例"
              />
              <SliderInput
                label="单股仓位上限"
                value={position.maxSinglePosition}
                onChange={v => setPosition(prev => ({ ...prev, maxSinglePosition: v }))}
                min={0.05} max={1} step={0.05}
                format={v => `${(v * 100).toFixed(0)}%`}
                disabled={readonly_}
                hint="单只股票最多占总资金的比例"
              />
              <SliderInput
                label="最低现金储备"
                value={position.minCashReserve}
                onChange={v => setPosition(prev => ({ ...prev, minCashReserve: v }))}
                min={0} max={0.5} step={0.05}
                format={v => `${(v * 100).toFixed(0)}%`}
                disabled={readonly_}
                hint="始终保留的现金比例"
              />
              <SliderInput
                label="单次买入比例"
                value={position.positionSize}
                onChange={v => setPosition(prev => ({ ...prev, positionSize: v }))}
                min={0.05} max={1} step={0.05}
                format={v => `${(v * 100).toFixed(0)}%`}
                disabled={readonly_}
                hint="每次买入使用可用资金的比例"
              />
              <div className="border-t border-border-subtle pt-3 space-y-3">
                <ToggleInput
                  label="允许加仓（金字塔加仓）"
                  value={position.enablePyramiding}
                  onChange={v => setPosition(prev => ({ ...prev, enablePyramiding: v }))}
                  disabled={readonly_}
                />
                {position.enablePyramiding && (
                  <SliderInput
                    label="最多加仓次数"
                    value={position.maxPyramidLevels}
                    onChange={v => setPosition(prev => ({ ...prev, maxPyramidLevels: Math.round(v) }))}
                    min={1} max={5} step={1}
                    format={v => `${v}次`}
                    disabled={readonly_}
                  />
                )}
              </div>
            </div>
          )}

          {/* 风险控制 */}
          {activeTab === 'risk' && (
            <div className="space-y-4">
              <SliderInput
                label="止损比例"
                value={risk.stopLoss}
                onChange={v => setRisk(prev => ({ ...prev, stopLoss: v }))}
                min={0} max={0.3} step={0.005}
                format={v => v === 0 ? '不启用' : `-${(v * 100).toFixed(1)}%`}
                disabled={readonly_}
                hint="亏损达到此比例自动卖出"
              />
              <SliderInput
                label="止盈比例"
                value={risk.takeProfit}
                onChange={v => setRisk(prev => ({ ...prev, takeProfit: v }))}
                min={0} max={0.5} step={0.005}
                format={v => v === 0 ? '不启用' : `+${(v * 100).toFixed(1)}%`}
                disabled={readonly_}
                hint="盈利达到此比例自动卖出"
              />
              <SliderInput
                label="移动止损（追踪止损）"
                value={risk.trailingStop}
                onChange={v => setRisk(prev => ({ ...prev, trailingStop: v }))}
                min={0} max={0.3} step={0.005}
                format={v => v === 0 ? '不启用' : `-${(v * 100).toFixed(1)}%`}
                disabled={readonly_}
                hint="从最高价回落此比例自动卖出"
              />
              <SliderInput
                label="最长持仓天数"
                value={risk.maxHoldingDays}
                onChange={v => setRisk(prev => ({ ...prev, maxHoldingDays: Math.round(v) }))}
                min={0} max={120} step={1}
                format={v => v === 0 ? '不限制' : `${v}天`}
                disabled={readonly_}
                hint="超过此天数强制卖出"
              />

              {/* 风控预览 */}
              {(risk.stopLoss > 0 || risk.takeProfit > 0 || risk.trailingStop > 0 || risk.maxHoldingDays > 0) && (
                <div className="bg-surface-raised rounded p-3 space-y-1">
                  <div className="text-[10px] text-amber-400 font-medium">风控规则预览</div>
                  {risk.stopLoss > 0 && (
                    <div className="text-[10px] text-text-secondary">
                      <span className="text-accent-green">止损:</span> 亏损 {(risk.stopLoss * 100).toFixed(1)}% 时自动卖出
                    </div>
                  )}
                  {risk.takeProfit > 0 && (
                    <div className="text-[10px] text-text-secondary">
                      <span className="text-accent-red">止盈:</span> 盈利 {(risk.takeProfit * 100).toFixed(1)}% 时自动卖出
                    </div>
                  )}
                  {risk.trailingStop > 0 && (
                    <div className="text-[10px] text-text-secondary">
                      <span className="text-amber-400">追踪止损:</span> 从最高价回落 {(risk.trailingStop * 100).toFixed(1)}% 时卖出
                    </div>
                  )}
                  {risk.maxHoldingDays > 0 && (
                    <div className="text-[10px] text-text-secondary">
                      <span className="text-text-primary">时间止损:</span> 持仓超过 {risk.maxHoldingDays} 天强制卖出
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 交易成本 */}
          {activeTab === 'cost' && (
            <div className="space-y-4">
              <SliderInput
                label="手续费率"
                value={cost.commission}
                onChange={v => setCost(prev => ({ ...prev, commission: v }))}
                min={0} max={0.001} step={0.00005}
                format={v => `万分${(v * 10000).toFixed(1)}`}
                disabled={readonly_}
                hint="每笔交易的手续费比例"
              />
              <SliderInput
                label="滑点"
                value={cost.slippage}
                onChange={v => setCost(prev => ({ ...prev, slippage: v }))}
                min={0} max={0.005} step={0.0001}
                format={v => `${(v * 100).toFixed(2)}%`}
                disabled={readonly_}
                hint="模拟真实交易的买卖价差"
              />

              {/* 成本示例 */}
              <div className="bg-surface-raised rounded p-3 space-y-1">
                <div className="text-[10px] text-text-secondary font-medium">成本示例（10万元交易）</div>
                <div className="text-[10px] text-text-secondary">
                  手续费: <span className="text-text-primary font-mono">¥{(100000 * cost.commission).toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-text-secondary">
                  滑点成本: <span className="text-text-primary font-mono">¥{(100000 * cost.slippage).toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-text-secondary border-t border-border-subtle pt-1 mt-1">
                  单次交易总成本: <span className="text-text-primary font-mono">¥{(100000 * (cost.commission + cost.slippage)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle">
          {readonly_ ? (
            <button
              onClick={onCancel}
              className="px-4 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface-raised rounded transition-colors"
            >
              关闭
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface-raised rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || (signals.buySignals.length === 0 && signals.sellSignals.length === 0)}
                className="px-4 py-1.5 text-xs text-white bg-accent-blue rounded hover:bg-accent-blue/80 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={12} />
                保存
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
