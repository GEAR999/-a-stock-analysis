/**
 * 自定义策略面板
 * 用于创建、编辑、删除自定义交易策略
 */

'use client';

import { useState, useEffect } from 'react';
import type { CustomStrategy, StrategySource, TradeConditions, PriceConditionType, VolumeConditionType, PatternCondition } from '../backtest/types';
import {
  getAllCustomStrategies,
  saveCustomStrategy,
  deleteCustomStrategy,
  createNewCustomStrategy,
} from '../backtest/strategy-storage';

interface CustomStrategyPanelProps {
  onUseStrategy?: (strategy: CustomStrategy) => void;
  onClose?: () => void;
}

// 理论选项
const THEORY_OPTIONS: { value: StrategySource; label: string; color: string }[] = [
  { value: 'chanlun', label: '缠论', color: 'text-purple-400 bg-purple-900/30' },
  { value: 'wave', label: '波浪理论', color: 'text-[var(--accent-blue)] bg-blue-900/30' },
  { value: 'technical', label: '技术指标', color: 'text-[var(--accent-green)] bg-green-900/30' },
];

// 价格条件选项
const PRICE_CONDITION_OPTIONS: { value: PriceConditionType; label: string }[] = [
  { value: 'above_ma', label: '突破均线' },
  { value: 'below_ma', label: '跌破均线' },
  { value: 'above_price', label: '突破价位' },
  { value: 'below_price', label: '跌破价位' },
  { value: 'above_high', label: '突破新高' },
  { value: 'below_low', label: '跌破新低' },
];

// 成交量条件选项
const VOLUME_CONDITION_OPTIONS: { value: VolumeConditionType; label: string }[] = [
  { value: 'above_avg', label: '放量（均量倍数）' },
  { value: 'below_avg', label: '缩量（均量倍数）' },
  { value: 'volume_surge', label: '成交量突增' },
];

// 形态条件选项
const PATTERN_OPTIONS: { value: PatternCondition; label: string }[] = [
  { value: 'hammer', label: '锤子线' },
  { value: 'engulfing_bull', label: '看涨吞没' },
  { value: 'engulfing_bear', label: '看跌吞没' },
  { value: 'doji', label: '十字星' },
  { value: 'morning_star', label: '晨星' },
  { value: 'evening_star', label: '暮星' },
  { value: 'double_bottom', label: '双底' },
  { value: 'double_top', label: '双顶' },
];

export default function CustomStrategyPanel({ onUseStrategy, onClose }: CustomStrategyPanelProps) {
  const [strategies, setStrategies] = useState<CustomStrategy[]>([]);
  const [editingStrategy, setEditingStrategy] = useState<CustomStrategy | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 加载策略列表
  useEffect(() => {
    setStrategies(getAllCustomStrategies());
  }, []);

  // 创建新策略
  const handleCreate = () => {
    const newStrategy = createNewCustomStrategy();
    setEditingStrategy(newStrategy);
    setShowEditor(true);
  };

  // 编辑策略
  const handleEdit = (strategy: CustomStrategy) => {
    setEditingStrategy({ ...strategy });
    setShowEditor(true);
  };

  // 保存策略
  const handleSave = () => {
    if (!editingStrategy) return;
    saveCustomStrategy(editingStrategy);
    setStrategies(getAllCustomStrategies());
    setShowEditor(false);
    setEditingStrategy(null);
  };

  // 删除策略
  const handleDelete = (id: string) => {
    deleteCustomStrategy(id);
    setStrategies(getAllCustomStrategies());
    setDeleteConfirm(null);
  };

  // 使用策略
  const handleUse = (strategy: CustomStrategy) => {
    if (onUseStrategy) {
      onUseStrategy(strategy);
    }
  };

  // 策略编辑器
  if (showEditor && editingStrategy) {
    return (
      <StrategyEditor
        strategy={editingStrategy}
        onChange={setEditingStrategy}
        onSave={handleSave}
        onCancel={() => { setShowEditor(false); setEditingStrategy(null); }}
      />
    );
  }

  return (
    <div className="bg-[var(--bg-primary)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[var(--text-primary)] font-bold text-lg">自定义策略</h3>
        <button
          onClick={handleCreate}
          className="bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] px-4 py-2 rounded text-sm flex items-center gap-1"
        >
          <span>+</span> 新建策略
        </button>
      </div>

      {strategies.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-secondary)]">
          <p className="text-4xl mb-2">📋</p>
          <p>暂无自定义策略</p>
          <p className="text-sm mt-1">点击"新建策略"创建您的第一个策略</p>
        </div>
      ) : (
        <div className="space-y-3">
          {strategies.map(strategy => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              onEdit={() => handleEdit(strategy)}
              onDelete={() => setDeleteConfirm(strategy.id)}
              onUse={() => handleUse(strategy)}
            />
          ))}
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-panel)] rounded-lg p-6 max-w-sm">
            <h4 className="text-[var(--text-primary)] font-bold mb-2">确认删除</h4>
            <p className="text-[var(--text-secondary)] text-sm mb-4">确定要删除这个策略吗？此操作不可撤销。</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-[var(--text-primary)] rounded"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 策略卡片
function StrategyCard({ 
  strategy, 
  onEdit, 
  onDelete, 
  onUse 
}: { 
  strategy: CustomStrategy;
  onEdit: () => void;
  onDelete: () => void;
  onUse: () => void;
}) {
  const theoryLabels = strategy.theories.map(t => {
    const opt = THEORY_OPTIONS.find(o => o.value === t);
    return opt ? opt.label : t;
  });

  return (
    <div className="bg-[var(--bg-panel)] rounded-lg p-4 border border-[var(--border-default)] hover:border-[var(--border-default)] transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-[var(--text-primary)] font-medium">{strategy.name}</h4>
          {strategy.description && (
            <p className="text-[var(--text-secondary)] text-xs mt-1">{strategy.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onUse}
            className="text-xs px-2 py-1 bg-blue-600/20 text-[var(--accent-blue)] hover:bg-blue-600/30 rounded"
          >
            使用
          </button>
          <button
            onClick={onEdit}
            className="text-xs px-2 py-1 bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--text-muted)] rounded"
          >
            编辑
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1 bg-red-900/30 text-[var(--accent-red)] hover:bg-red-900/50 rounded"
          >
            删除
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1 mb-2">
        {strategy.theories.map(t => {
          const opt = THEORY_OPTIONS.find(o => o.value === t);
          return opt ? (
            <span key={t} className={`text-xs px-2 py-0.5 rounded ${opt.color}`}>
              {opt.label}
            </span>
          ) : null;
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-[var(--text-secondary)]">
        <div>
          <span className="text-[var(--text-secondary)]">仓位:</span>{' '}
          <span className="text-[var(--text-primary)]">{(strategy.positionRatio * 100).toFixed(0)}%</span>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]">止损:</span>{' '}
          <span className="text-[var(--accent-red)]">{(strategy.stopLoss * 100).toFixed(0)}%</span>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]">止盈:</span>{' '}
          <span className="text-[var(--accent-green)]">{(strategy.takeProfit * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// 策略编辑器
function StrategyEditor({
  strategy,
  onChange,
  onSave,
  onCancel,
}: {
  strategy: CustomStrategy;
  onChange: (s: CustomStrategy) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'buy' | 'sell' | 'risk'>('basic');

  const updateTheory = (theory: StrategySource, checked: boolean) => {
    const theories = checked
      ? [...strategy.theories, theory]
      : strategy.theories.filter(t => t !== theory);
    onChange({ ...strategy, theories });
  };

  const updateBuyConditions = (conditions: Partial<TradeConditions>) => {
    onChange({ ...strategy, buyConditions: { ...strategy.buyConditions, ...conditions } });
  };

  const updateSellConditions = (conditions: Partial<TradeConditions>) => {
    onChange({ ...strategy, sellConditions: { ...strategy.sellConditions, ...conditions } });
  };

  const tabs = [
    { id: 'basic' as const, label: '基本信息' },
    { id: 'buy' as const, label: '买入条件' },
    { id: 'sell' as const, label: '卖出条件' },
    { id: 'risk' as const, label: '风控设置' },
  ];

  return (
    <div className="bg-[var(--bg-primary)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[var(--text-primary)] font-bold text-lg">
          {strategy.name === '新策略' ? '新建策略' : '编辑策略'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded"
          >
            保存
          </button>
        </div>
      </div>

      {/* Tab导航 */}
      <div className="flex gap-1 mb-4 border-b border-[var(--border-default)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm ${
              activeTab === tab.id
                ? 'text-[var(--accent-blue)] border-b-2 border-blue-400'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 基本信息 */}
      {activeTab === 'basic' && (
        <div className="space-y-4">
          <div>
            <label className="text-[var(--text-secondary)] text-sm block mb-1">策略名称</label>
            <input
              type="text"
              value={strategy.name}
              onChange={(e) => onChange({ ...strategy, name: e.target.value })}
              className="w-full bg-[var(--bg-panel)] text-[var(--text-primary)] px-3 py-2 rounded border border-[var(--border-default)] focus:border-[var(--accent-blue)] outline-none"
              placeholder="输入策略名称"
            />
          </div>
          <div>
            <label className="text-[var(--text-secondary)] text-sm block mb-1">策略描述</label>
            <textarea
              value={strategy.description || ''}
              onChange={(e) => onChange({ ...strategy, description: e.target.value })}
              className="w-full bg-[var(--bg-panel)] text-[var(--text-primary)] px-3 py-2 rounded border border-[var(--border-default)] focus:border-[var(--accent-blue)] outline-none h-20 resize-none"
              placeholder="描述策略的核心逻辑"
            />
          </div>
          <div>
            <label className="text-[var(--text-secondary)] text-sm block mb-2">分析理论组合</label>
            <div className="flex flex-wrap gap-2">
              {THEORY_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                    strategy.theories.includes(opt.value)
                      ? opt.color
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={strategy.theories.includes(opt.value)}
                    onChange={(e) => updateTheory(opt.value, e.target.checked)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 买入条件 */}
      {activeTab === 'buy' && (
        <TradeConditionsEditor
          conditions={strategy.buyConditions}
          onChange={updateBuyConditions}
          title="买入条件"
        />
      )}

      {/* 卖出条件 */}
      {activeTab === 'sell' && (
        <TradeConditionsEditor
          conditions={strategy.sellConditions}
          onChange={updateSellConditions}
          title="卖出条件"
        />
      )}

      {/* 风控设置 */}
      {activeTab === 'risk' && (
        <div className="space-y-4">
          <div>
            <label className="text-[var(--text-secondary)] text-sm block mb-1">
              默认仓位比例: {(strategy.positionRatio * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={strategy.positionRatio}
              onChange={(e) => onChange({ ...strategy, positionRatio: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
              <span>10%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
          <div>
            <label className="text-[var(--text-secondary)] text-sm block mb-1">
              止损比例: {(strategy.stopLoss * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.02"
              max="0.3"
              step="0.01"
              value={strategy.stopLoss}
              onChange={(e) => onChange({ ...strategy, stopLoss: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
              <span>2%</span>
              <span>15%</span>
              <span>30%</span>
            </div>
          </div>
          <div>
            <label className="text-[var(--text-secondary)] text-sm block mb-1">
              止盈比例: {(strategy.takeProfit * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={strategy.takeProfit}
              onChange={(e) => onChange({ ...strategy, takeProfit: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
              <span>5%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 交易条件编辑器
function TradeConditionsEditor({
  conditions,
  onChange,
  title,
}: {
  conditions: TradeConditions;
  onChange: (c: Partial<TradeConditions>) => void;
  title: string;
}) {
  return (
    <div className="space-y-4">
      {/* 价格条件 */}
      <div className="bg-[var(--bg-panel)] rounded p-3">
        <h5 className="text-[var(--text-primary)] text-sm font-medium mb-2">价格条件</h5>
        <div className="flex gap-2">
          <select
            value={conditions.priceCondition?.type || ''}
            onChange={(e) => {
              if (e.target.value) {
                onChange({
                  priceCondition: {
                    type: e.target.value as PriceConditionType,
                    value: conditions.priceCondition?.value || 0,
                  },
                });
              } else {
                onChange({ priceCondition: undefined });
              }
            }}
            className="bg-[var(--bg-primary)] text-[var(--text-primary)] px-3 py-2 rounded border border-[var(--border-default)] text-sm flex-1"
          >
            <option value="">不设置</option>
            {PRICE_CONDITION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {conditions.priceCondition && (
            <input
              type="number"
              value={conditions.priceCondition.value}
              onChange={(e) => onChange({
                priceCondition: {
                  ...conditions.priceCondition!,
                  value: parseFloat(e.target.value) || 0,
                },
              })}
              className="bg-[var(--bg-primary)] text-[var(--text-primary)] px-3 py-2 rounded border border-[var(--border-default)] text-sm w-24"
              placeholder="数值"
            />
          )}
        </div>
      </div>

      {/* 成交量条件 */}
      <div className="bg-[var(--bg-panel)] rounded p-3">
        <h5 className="text-[var(--text-primary)] text-sm font-medium mb-2">成交量条件</h5>
        <div className="flex gap-2">
          <select
            value={conditions.volumeCondition?.type || ''}
            onChange={(e) => {
              if (e.target.value) {
                onChange({
                  volumeCondition: {
                    type: e.target.value as VolumeConditionType,
                    multiplier: conditions.volumeCondition?.multiplier || 1.5,
                  },
                });
              } else {
                onChange({ volumeCondition: undefined });
              }
            }}
            className="bg-[var(--bg-primary)] text-[var(--text-primary)] px-3 py-2 rounded border border-[var(--border-default)] text-sm flex-1"
          >
            <option value="">不设置</option>
            {VOLUME_CONDITION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {conditions.volumeCondition && (
            <input
              type="number"
              value={conditions.volumeCondition.multiplier}
              step="0.1"
              onChange={(e) => onChange({
                volumeCondition: {
                  ...conditions.volumeCondition!,
                  multiplier: parseFloat(e.target.value) || 1,
                },
              })}
              className="bg-[var(--bg-primary)] text-[var(--text-primary)] px-3 py-2 rounded border border-[var(--border-default)] text-sm w-24"
              placeholder="倍数"
            />
          )}
        </div>
      </div>

      {/* 形态条件 */}
      <div className="bg-[var(--bg-panel)] rounded p-3">
        <h5 className="text-[var(--text-primary)] text-sm font-medium mb-2">形态条件</h5>
        <div className="flex flex-wrap gap-2">
          {PATTERN_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer ${
                conditions.patternConditions?.includes(opt.value)
                  ? 'bg-blue-600/30 text-[var(--accent-blue)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
              }`}
            >
              <input
                type="checkbox"
                checked={conditions.patternConditions?.includes(opt.value) || false}
                onChange={(e) => {
                  const current = conditions.patternConditions || [];
                  const updated = e.target.checked
                    ? [...current, opt.value]
                    : current.filter(p => p !== opt.value);
                  onChange({ patternConditions: updated });
                }}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
