'use client';

import React from 'react';
import type { PredictionResult } from '@/lib/ml/types';

interface Props {
  indexName: string;
  prediction: PredictionResult | null;
}

export function MLCurrentPrediction({ indexName, prediction }: Props) {
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.7) return 'text-green-400';
    if (conf >= 0.55) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getDirectionColor = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up': return 'text-red-400'; // A股红涨
      case 'down': return 'text-green-400'; // A股绿跌
      default: return 'text-gray-400';
    }
  };

  const getDirectionLabel = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up': return '看涨';
      case 'down': return '看跌';
      default: return '震荡';
    }
  };

  if (!prediction) {
    return (
      <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30">
        <div className="text-xs text-gray-500 mb-1">{indexName}</div>
        <div className="text-sm text-gray-600">暂无预测</div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600/50 transition-colors">
      <div className="text-xs text-gray-500 mb-2">{indexName}</div>

      {/* 方向 + 概率 */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-lg font-bold ${getDirectionColor(prediction.direction)}`}>
          {getDirectionLabel(prediction.direction)}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-red-400">涨 {prediction.upProb.toFixed(1)}%</span>
          <span className="text-green-400">跌 {prediction.downProb.toFixed(1)}%</span>
        </div>
      </div>

      {/* 置信度 */}
      <div className="flex items-center justify-between">
        <span className={`text-xs ${getConfidenceColor(prediction.confidence)}`}>
          置信度 {(prediction.confidence * 100).toFixed(0)}%
        </span>
      </div>

      {/* 置信度进度条 */}
      <div className="mt-1.5 h-1 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            prediction.confidence >= 0.7 ? 'bg-green-500' :
            prediction.confidence >= 0.55 ? 'bg-yellow-500' : 'bg-gray-600'
          }`}
          style={{ width: `${prediction.confidence * 100}%` }}
        />
      </div>
    </div>
  );
}