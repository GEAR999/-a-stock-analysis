'use client';

import React from 'react';

interface TrainingProgressProps {
  currentEpoch: number;
  totalEpochs: number;
  history: { epoch: number; loss: number; accuracy: number; valAccuracy: number }[];
}

export function MLTrainingProgress({ currentEpoch, totalEpochs, history }: TrainingProgressProps) {
  const progress = totalEpochs > 0 ? (currentEpoch / totalEpochs) * 100 : 0;
  const latest = history[history.length - 1];
  const bestVal = history.length > 0
    ? Math.max(...history.map(h => h.valAccuracy))
    : 0;

  // 计算曲线路径
  const width = 280;
  const height = 100;
  const maxEpoch = history.length > 0 ? Math.max(...history.map(h => h.epoch)) : 1;
  const maxAcc = 100;

  const accPath = history.length > 1
    ? history.map((h, i) => {
      const x = (h.epoch / maxEpoch) * width;
      const y = height - (h.accuracy / maxAcc) * height;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ')
    : '';

  const valPath = history.length > 1
    ? history.map((h, i) => {
      const x = (h.epoch / maxEpoch) * width;
      const y = height - (h.valAccuracy / maxAcc) * height;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ')
    : '';

  return (
    <div className="space-y-3">
      {/* 进度条 */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>训练进度</span>
          <span>{currentEpoch}/{totalEpochs} 轮</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* 训练曲线 */}
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
          {/* 网格线 */}
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
          {/* 训练集曲线 */}
          {accPath && <path d={accPath} fill="none" stroke="#3B82F6" strokeWidth={2} />}
          {/* 验证集曲线 */}
          {valPath && <path d={valPath} fill="none" stroke="#10B981" strokeWidth={2} />}
          {/* 图例 */}
          <line x1={width - 80} y1={10} x2={width - 65} y2={10} stroke="#3B82F6" strokeWidth={2} />
          <text x={width - 60} y={13} fill="#9CA3AF" fontSize={10}>训练</text>
          <line x1={width - 40} y1={10} x2={width - 25} y2={10} stroke="#10B981" strokeWidth={2} />
          <text x={width - 20} y={13} fill="#9CA3AF" fontSize={10}>验证</text>
        </svg>
      </div>

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