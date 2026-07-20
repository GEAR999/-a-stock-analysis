'use client';

import { useState, useEffect } from 'react';
import {
  loadAlerts,
  addAlert,
  updateAlert,
  deleteAlert,
  resetAlert,
  type PriceAlert,
  type AlertCondition,
} from '@/lib/price-alert';
import { useAppState } from '@/hooks/useAppState';

interface PriceAlertPanelProps {
  onClose?: () => void;
}

export function PriceAlertPanel({ onClose }: PriceAlertPanelProps) {
  const { watchlist, selectedStock, currentQuote } = useAppState();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    condition: 'above' as AlertCondition,
    value: '',
    repeatTrigger: false,
  });

  useEffect(() => {
    setAlerts(loadAlerts());
  }, []);

  // 预选当前股票
  useEffect(() => {
    if (selectedStock && !formData.code) {
      setFormData(prev => ({
        ...prev,
        code: selectedStock.code,
        name: selectedStock.name,
      }));
    }
  }, [selectedStock, formData.code]);

  const handleAdd = () => {
    if (!formData.code || !formData.value) return;

    addAlert({
      code: formData.code,
      name: formData.name,
      condition: formData.condition,
      value: parseFloat(formData.value),
      enabled: true,
      repeatTrigger: formData.repeatTrigger,
    });

    setAlerts(loadAlerts());
    setShowForm(false);
    setFormData({ code: '', name: '', condition: 'above', value: '', repeatTrigger: false });
  };

  const handleToggle = (id: string, enabled: boolean) => {
    updateAlert(id, { enabled });
    setAlerts(loadAlerts());
  };

  const handleDelete = (id: string) => {
    deleteAlert(id);
    setAlerts(loadAlerts());
  };

  const handleReset = (id: string) => {
    resetAlert(id);
    setAlerts(loadAlerts());
  };

  const getConditionLabel = (condition: AlertCondition) => {
    switch (condition) {
      case 'above': return '突破';
      case 'below': return '跌破';
      case 'change_pct': return '涨跌幅超过';
    }
  };

  const getConditionUnit = (condition: AlertCondition) => {
    switch (condition) {
      case 'above':
      case 'below': return '元';
      case 'change_pct': return '%';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
        <span className="text-sm font-medium text-[var(--text-primary)]">价格预警</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-xs bg-[var(--accent-blue)] text-[var(--text-primary)] rounded hover:bg-[var(--accent-blue)] transition-colors"
          >
            {showForm ? '取消' : '+ 新增预警'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-panel)]">
          <div className="space-y-3">
            {/* 股票选择 */}
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">股票</label>
              <select
                value={formData.code}
                onChange={(e) => {
                  const stock = watchlist.find(w => w.code === e.target.value);
                  if (stock) {
                    setFormData(prev => ({ ...prev, code: stock.code, name: stock.name }));
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-card)] text-[var(--text-primary)] rounded border border-[var(--border-default)] focus:border-[var(--accent-blue)] focus:outline-none"
              >
                <option value="">选择股票</option>
                {watchlist.map(w => (
                  <option key={w.code} value={w.code}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            {/* 条件选择 */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-[var(--text-secondary)] mb-1">条件</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value as AlertCondition }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-card)] text-[var(--text-primary)] rounded border border-[var(--border-default)] focus:border-[var(--accent-blue)] focus:outline-none"
                >
                  <option value="above">突破</option>
                  <option value="below">跌破</option>
                  <option value="change_pct">涨跌幅超过</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  {formData.condition === 'change_pct' ? '百分比(%)' : '价格(元)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder={formData.condition === 'change_pct' ? '如: 5' : '如: 150.00'}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-card)] text-[var(--text-primary)] rounded border border-[var(--border-default)] focus:border-[var(--accent-blue)] focus:outline-none"
                />
              </div>
            </div>

            {/* 重复触发 */}
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={formData.repeatTrigger}
                onChange={(e) => setFormData(prev => ({ ...prev, repeatTrigger: e.target.checked }))}
                className="rounded border-[var(--border-default)]"
              />
              重复触发（触发后继续监控）
            </label>

            <button
              onClick={handleAdd}
              disabled={!formData.code || !formData.value}
              className="w-full py-2 text-xs bg-[var(--accent-blue)] text-[var(--text-primary)] rounded hover:bg-[var(--accent-blue)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              添加预警
            </button>
          </div>
        </div>
      )}

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
            暂无预警规则
          </div>
        ) : (
          <div className="divide-y divide-[#1e293b]">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`px-4 py-3 ${alert.triggered && !alert.repeatTrigger ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-[var(--text-primary)]">{alert.name}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{alert.code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.triggered && !alert.repeatTrigger && (
                      <span className="text-[10px] text-[var(--text-secondary)]">已触发</span>
                    )}
                    <button
                      onClick={() => handleToggle(alert.id, !alert.enabled)}
                      className={`px-2 py-1 text-[10px] rounded ${
                        alert.enabled
                          ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]'
                          : 'bg-[var(--text-secondary)]/20 text-[var(--text-secondary)]'
                      }`}
                    >
                      {alert.enabled ? '启用' : '暂停'}
                    </button>
                    {alert.triggered && (
                      <button
                        onClick={() => handleReset(alert.id)}
                        className="px-2 py-1 text-[10px] bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] rounded"
                      >
                        重置
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="px-2 py-1 text-[10px] bg-[var(--accent-red)]/20 text-[var(--accent-red)] rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs">
                  <span className="text-[var(--text-secondary)]">
                    {getConditionLabel(alert.condition)} {alert.value}{getConditionUnit(alert.condition)}
                  </span>
                  {alert.triggerCount > 0 && (
                    <span className="ml-2 text-[var(--accent-yellow)]">
                      已触发 {alert.triggerCount} 次
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
