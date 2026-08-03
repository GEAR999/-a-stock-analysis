'use client';

import React from 'react';
import type { FeatureImportance } from '@/lib/ml/types';

interface Props {
  features: FeatureImportance[];
}

export function MLFeatureImportance({ features }: Props) {
  if (features.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-3">暂无特征重要性数据</div>
    );
  }

  const maxImportance = features.length > 0 ? Math.max(...features.map(f => f.importance)) : 1;
  const sorted = [...features].sort((a, b) => b.importance - a.importance);
  const top15 = sorted.slice(0, 15);

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400 mb-2">
        Top {top15.length} 特征重要性
        <span className="ml-2 text-gray-500">（打乱特征后准确率下降越多，越重要）</span>
      </div>
      {top15.map((f, i) => {
        const barWidth = (f.importance / maxImportance) * 100;
        const color = i === 0 ? '#3B82F6' : i < 3 ? '#10B981' : i < 6 ? '#F59E0B' : '#6B7280';
        return (
          <div key={f.name} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-3 text-right">{i + 1}</span>
            <span className="text-xs text-gray-300 w-24 truncate flex-shrink-0" title={f.name}>
              {f.name}
            </span>
            <div className="flex-1 bg-gray-700 rounded-full h-4">
              <div
                className="h-4 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(barWidth, 2)}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs text-gray-400 w-12 text-right font-mono">
              {(f.importance * 100).toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}