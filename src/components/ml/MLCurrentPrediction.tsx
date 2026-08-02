'use client';

import React from 'react';

interface CurrentPredictionProps {
  indexName: string;
  upProb: number;
  downProb: number;
  confidence: '高' | '中' | '低';
  topFeatures: { name: string; value: number }[];
}

export function MLCurrentPrediction({
  indexName,
  upProb,
  downProb,
  confidence,
  topFeatures,
}: CurrentPredictionProps) {
  const isHigh = upProb >= 70;
  const isLow = upProb <= 30;
  const dateStr = new Date().toLocaleDateString();

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 font-medium mb-2">当前预测</div>
      {/* 预测结果 */}
      <div className="text-center">
        <div className="text-xs text-gray-400">{indexName}</div>
        <div className="text-3xl font-bold mt-1 font-mono"
          style={{ color: isHigh ? '#EF4444' : isLow ? '#22C55E' : '#F59E0B' }}>
          {upProb}%
        </div>
        <div className="text-xs mt-1">
          <span className={isHigh ? 'text-red-400' : isLow ? 'text-green-400' : 'text-yellow-400'}>
            {confidence === '高' ? '⭐' : confidence === '中' ? '●' : '○'}
            {' '}次日{isHigh ? '大概率上涨' : isLow ? '大概率下跌' : '震荡概率大'}
          </span>
        </div>
        <div className="text-[10px] text-gray-600 mt-1">
          上涨{upProb}% / 下跌{downProb}% · 更新于 {dateStr}
        </div>
      </div>

      {/* 关键依据 */}
      {topFeatures.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-gray-500 uppercase">关键依据</div>
          {topFeatures.map((f, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-400">{f.name}</span>
              <span className="text-gray-300 font-mono">{(f.value * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}