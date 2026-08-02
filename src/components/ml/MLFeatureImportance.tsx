'use client';

import React from 'react';

interface FeatureImportanceProps {
  features: { name: string; importance: number }[];
  baselineAccuracy: number;
}

export function MLFeatureImportance({ features, baselineAccuracy }: FeatureImportanceProps) {
  const maxImportance = features.length > 0 ? Math.max(...features.map(f => f.importance)) : 1;
  const sorted = [...features].sort((a, b) => b.importance - a.importance);

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400 mb-2">
        基线准确率：{baselineAccuracy.toFixed(1)}%
        <span className="ml-2 text-gray-500">（打乱特征后准确率下降越多，该特征越重要）</span>
      </div>
      {sorted.map((f, i) => {
        const barWidth = (f.importance / maxImportance) * 100;
        const color = i === 0 ? '#3B82F6' : i < 3 ? '#10B981' : '#6B7280';
        return (
          <div key={f.name} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-3 text-right">{i + 1}</span>
            <span className="text-xs text-gray-300 w-24 truncate flex-shrink-0">{f.name}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-4">
              <div
                className="h-4 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(barWidth, 2)}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs text-gray-400 w-12 text-right font-mono">
              {f.importance.toFixed(3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}