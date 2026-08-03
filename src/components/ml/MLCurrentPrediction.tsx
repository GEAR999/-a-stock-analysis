'use client';

import React from 'react';

interface Props {
  indexName: string;
  upProb: number;
  confidence: number;
}

export function MLCurrentPrediction({ indexName, upProb, confidence }: Props) {
  const direction = upProb > 0.5 ? 'up' as const : 'down' as const;
  const downProb = 1 - upProb;

  const getConfidenceLabel = (c: number): string => {
    if (c >= 0.15) return '高';
    if (c >= 0.05) return '中';
    return '低';
  };

  const getConfidenceColor = (c: number) => {
    if (c >= 0.15) return 'text-green-400';
    if (c >= 0.05) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getConfidencePercent = (c: number): number => {
    return Math.min(c * 5, 0.85);
  };

  const getDirectionColor = (dir: 'up' | 'down') => {
    switch (dir) {
      case 'up': return 'text-red-400';
      case 'down': return 'text-green-400';
    }
  };

  const getDirectionLabel = (dir: 'up' | 'down') => {
    switch (dir) {
      case 'up': return '看涨';
      case 'down': return '看跌';
    }
  };

  const hasValidProb = isFinite(upProb) && isFinite(downProb);

  return (
    <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600/50 transition-colors">
      <div className="text-xs text-gray-500 mb-2">{indexName}</div>

      {/* 方向 + 概率 */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-lg font-bold ${getDirectionColor(direction)}`}>
          {getDirectionLabel(direction)}
        </span>
        <div className="flex items-center gap-3 text-xs">
          {hasValidProb ? (
            <>
              <span className="text-red-400">涨 {(upProb * 100).toFixed(1)}%</span>
              <span className="text-green-400">跌 {(downProb * 100).toFixed(1)}%</span>
            </>
          ) : (
            <span className="text-gray-500">概率计算中...</span>
          )}
        </div>
      </div>

      {/* 置信度 */}
      <div className="flex items-center justify-between">
        <span className={`text-xs ${getConfidenceColor(confidence)}`}>
          置信度 {getConfidenceLabel(confidence)}
        </span>
      </div>

      {/* 置信度进度条 */}
      <div className="mt-1.5 h-1 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            confidence >= 0.15 ? 'bg-green-500' :
            confidence >= 0.05 ? 'bg-yellow-500' : 'bg-gray-600'
          }`}
          style={{ width: `${getConfidencePercent(confidence) * 100}%` }}
        />
      </div>
    </div>
  );
}