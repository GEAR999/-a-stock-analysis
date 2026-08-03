'use client';

import React from 'react';
import type { TrainingProgress } from '@/lib/ml/types';

interface Props {
  progress: TrainingProgress;
}

export function MLTrainingProgress({ progress }: Props) {
  const { phase, message, currentEpoch, totalEpochs, modelIndex, totalModels, history } = progress;

  // 训练阶段：显示集成模型进度
  if (phase === 'preparing') {
    return (
      <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-700/30">
        <div className="flex items-center gap-2 text-sm text-blue-400">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          {message}
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="p-3 rounded-lg bg-red-900/20 border border-red-700/30 text-sm text-red-400">
        {message}
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="p-3 rounded-lg bg-green-900/20 border border-green-700/30 text-sm text-green-400">
        {message}
      </div>
    );
  }

  // 训练中
  const progressPct = totalEpochs && totalEpochs > 0
    ? ((currentEpoch || 0) / totalEpochs) * 100
    : 0;

  const latest = history && history.length > 0 ? history[history.length - 1] : null;
  const bestVal = history && history.length > 0
    ? Math.max(...history.map(h => h.valAccuracy))
    : 0;

  // 曲线
  const width = 280;
  const height = 100;
  const maxEpoch = history && history.length > 0 ? Math.max(...history.map(h => h.epoch)) : 1;
  const maxAcc = 100;

  const accPath = history && history.length > 1
    ? history.map((h, i) => {
      const x = (h.epoch / maxEpoch) * width;
      const y = height - (h.accuracy / maxAcc) * height;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ')
    : '';

  const valPath = history && history.length > 1
    ? history.map((h, i) => {
      const x = (h.epoch / maxEpoch) * width;
      const y = height - (h.valAccuracy / maxAcc) * height;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ')
    : '';

  return (
    <div className="space-y-3 p-3 rounded-lg bg-blue-900/20 border border-blue-700/30">
      {/* 模型进度 */}
      {totalModels && totalModels > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">集成模型</span>
          <span className="text-blue-400">
            {modelIndex !== undefined ? `模型 ${modelIndex + 1}/${totalModels}` : ''}
          </span>
        </div>
      )}

      {/* 进度条 */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{message}</span>
          <span>{currentEpoch || 0}/{totalEpochs || 0} 轮</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
      </div>

      {/* 训练曲线 */}
      {history && history.length > 1 && (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>训练曲线</span>
            {latest && (
              <span>
                训练: {latest.accuracy.toFixed(1)}% | 验证: {latest.valAccuracy.toFixed(1)}%
              </span>
            )}
          </div>
          <svg width={width} height={height} className="w-full">
            {[0, 25, 50, 75, 100].map(v => (
              <React.Fragment key={v}>
                <line
                  x1={0} y1={height - (v / 100) * height}
                  x2={width} y2={height - (v / 100) * height}
                  stroke="#374151" strokeWidth={0.5}
                />
                <text x={2} y={height - (v / 100) * height - 2}
                  fill="#6B7280" fontSize={10}>
                  {v}%
                </text>
              </React.Fragment>
            ))}
            {accPath && <path d={accPath} fill="none" stroke="#3B82F6" strokeWidth={2} />}
            {valPath && <path d={valPath} fill="none" stroke="#10B981" strokeWidth={2} />}
            <line x1={width - 80} y1={10} x2={width - 65} y2={10} stroke="#3B82F6" strokeWidth={2} />
            <text x={width - 60} y={13} fill="#9CA3AF" fontSize={10}>训练</text>
            <line x1={width - 40} y1={10} x2={width - 25} y2={10} stroke="#10B981" strokeWidth={2} />
            <text x={width - 20} y={13} fill="#9CA3AF" fontSize={10}>验证</text>
          </svg>
        </div>
      )}

      {/* 当前状态 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">当前准确率</div>
          <div className="text-blue-400 font-bold text-sm">
            {latest ? `${latest.accuracy.toFixed(1)}%` : '--'}
          </div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">最佳验证准确率</div>
          <div className="text-green-400 font-bold text-sm">
            {bestVal > 0 ? `${bestVal.toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>
    </div>
  );
}