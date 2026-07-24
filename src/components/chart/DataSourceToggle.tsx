'use client';

import { useState } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

export interface DataSourceConfig {
  tushare: boolean;
  mootdx: boolean;
  eastmoney: boolean;
}

export const DEFAULT_DATASOURCE_CONFIG: DataSourceConfig = {
  tushare: true,
  mootdx: true,
  eastmoney: false, // 默认关闭东方财富（易限流）
};

// ============================================================================
// 组件
// ============================================================================

interface DataSourceToggleProps {
  currentSource: string;
  onConfigChange: (config: DataSourceConfig) => void;
}

export function DataSourceToggle({ currentSource, onConfigChange }: DataSourceToggleProps) {
  const [config, setConfig] = useState<DataSourceConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_DATASOURCE_CONFIG;
    const saved = localStorage.getItem('dataSourceConfig');
    return saved ? JSON.parse(saved) : DEFAULT_DATASOURCE_CONFIG;
  });

  const handleToggle = (source: keyof DataSourceConfig) => {
    const newConfig = { ...config, [source]: !config[source] };
    
    // 至少保留一个数据源
    const enabledCount = Object.values(newConfig).filter(Boolean).length;
    if (enabledCount === 0) {
      alert('至少需要启用一个数据源');
      return;
    }

    setConfig(newConfig);
    localStorage.setItem('dataSourceConfig', JSON.stringify(newConfig));
    onConfigChange(newConfig);
  };

  const handleReset = () => {
    setConfig(DEFAULT_DATASOURCE_CONFIG);
    localStorage.setItem('dataSourceConfig', JSON.stringify(DEFAULT_DATASOURCE_CONFIG));
    onConfigChange(DEFAULT_DATASOURCE_CONFIG);
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      {/* 当前数据源 */}
      <span className="text-[#94a3b8]">
        数据：
        <span className={`font-medium ${
          currentSource === 'tushare' ? 'text-blue-400' :
          currentSource === 'mootdx' ? 'text-green-400' :
          currentSource === 'eastmoney' ? 'text-red-400' :
          'text-[#94a3b8]'
        }`}>
          {currentSource || '未选择'}
        </span>
        {currentSource && <span className="text-green-500 ml-1">✓</span>}
      </span>

      {/* 快速开关 */}
      <div className="flex gap-1">
        <button
          onClick={() => handleToggle('tushare')}
          className={`px-2 py-0.5 rounded text-[10px] transition-all ${
            config.tushare
              ? currentSource === 'tushare'
                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
              : 'bg-[#1e293b] text-[#475569] line-through'
          }`}
          title="Tushare (2000 积分)"
        >
          T
        </button>

        <button
          onClick={() => handleToggle('mootdx')}
          className={`px-2 py-0.5 rounded text-[10px] transition-all ${
            config.mootdx
              ? currentSource === 'mootdx'
                ? 'bg-green-600 text-white ring-2 ring-green-400'
                : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
              : 'bg-[#1e293b] text-[#475569] line-through'
          }`}
          title="mootdx (本地服务)"
        >
          M
        </button>

        <button
          onClick={() => handleToggle('eastmoney')}
          className={`px-2 py-0.5 rounded text-[10px] transition-all ${
            config.eastmoney
              ? currentSource === 'eastmoney'
                ? 'bg-red-600 text-white ring-2 ring-red-400'
                : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
              : 'bg-[#1e293b] text-[#475569] line-through'
          }`}
          title="东方财富 (易限流)"
        >
          E
        </button>
      </div>

      {/* 恢复默认按钮 */}
      <button
        onClick={handleReset}
        className="text-[10px] text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
        title="恢复默认配置"
      >
        恢复默认
      </button>
    </div>
  );
}
