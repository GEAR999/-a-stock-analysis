'use client';

import React from 'react';

interface Props {
  indexName: string;
  upProb: number;
  confidence: number;
}

export function MLCurrentPrediction({ indexName, upProb, confidence }: Props) {
  const downProb = 1 - upProb;
  const direction = upProb >= 0.5 ? 'up' : 'down';
  const isHighConf = Math.abs(upProb - 0.5) > 0.15;
  const isMidConf = Math.abs(upProb - 0.5) > 0.08;

  const getConfidenceLabel = () => {
    if (!isHighConf && !isMidConf) return '低';
    if (isHighConf) return '高';
    return '中';
  };
  const confColor = getConfidenceLabel() === '高' ? 'text-emerald-400' : getConfidenceLabel() === '中' ? 'text-amber-400' : 'text-gray-500';

  // 主方向颜色
  const mainColor = direction === 'up' ? 'from-rose-900/40 to-rose-950/20' : 'from-emerald-900/40 to-emerald-950/20';
  const accentColor = direction === 'up' ? 'text-rose-400' : 'text-emerald-400';
  const badgeBg = direction === 'up' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300';

  // 概率条
  const upBarWidth = upProb * 100;
  const downBarWidth = downProb * 100;

  return (
    <div className={`rounded-lg border border-gray-700/50 bg-gradient-to-br ${mainColor} p-3`}>
      {/* 指数名称 */}
      <div className="text-xs text-gray-400 mb-2 truncate">{indexName}</div>

      {/* 方向标签 */}
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badgeBg} mb-2`}>
        {direction === 'up' ? '↑ 看涨' : '↓ 看跌'}
      </div>

      {/* 概率比例条 */}
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-700/50 mb-2">
        <div
          className="transition-all duration-500 rounded-l-full"
          style={{ width: `${upBarWidth}%`, backgroundColor: '#F43F5E' }}
        />
        <div
          className="transition-all duration-500 rounded-r-full"
          style={{ width: `${downBarWidth}%`, backgroundColor: '#10B981' }}
        />
      </div>

      {/* 概率数值 */}
      <div className="flex justify-between text-xs">
        <span className="text-rose-400">涨 {(upProb * 100).toFixed(1)}%</span>
        <span className="text-emerald-400">跌 {(downProb * 100).toFixed(1)}%</span>
      </div>

      {/* 置信度 */}
      <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
        <span className="text-gray-500">置信度</span>
        <span className={`font-medium ${confColor}`}>{getConfidenceLabel()}</span>
        <div className="flex gap-0.5 ml-auto">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i === 0 ? (getConfidenceLabel() === '高' ? 'bg-emerald-400' : 'bg-gray-600') :
                i === 1 ? (getConfidenceLabel() !== '低' ? 'bg-emerald-400' : 'bg-gray-600') :
                'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}