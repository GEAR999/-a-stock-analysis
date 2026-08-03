'use client';

import React from 'react';
import type { ConfusionMatrix } from '@/lib/ml/types';

interface Props {
  matrix: ConfusionMatrix;
}

export function MLConfusionMatrix({ matrix }: Props) {
  const { tp, fp, fn, tn } = matrix;
  const total = tp + fp + fn + tn;
  const accuracy = total > 0 ? ((tp + tn) / total * 100) : 0;
  const precision = (tp + fp) > 0 ? (tp / (tp + fp) * 100) : 0;
  const recall = (tp + fn) > 0 ? (tp / (tp + fn) * 100) : 0;
  const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-300">混淆矩阵</h4>
      {/* 混淆矩阵 */}
      <div className="grid grid-cols-[auto_auto_auto] gap-2 text-center text-xs items-center">
        <div className="text-gray-500">预测\实际</div>
        <div className="text-red-400">实际涨</div>
        <div className="text-green-400">实际跌</div>
        <div className="text-gray-500">预测涨</div>
        <div className="bg-green-900/40 rounded p-2">
          <div className="text-green-400 font-bold text-lg">{tp}</div>
          <div className="text-green-500">正确 ✓</div>
        </div>
        <div className="bg-red-900/40 rounded p-2">
          <div className="text-red-400 font-bold text-lg">{fp}</div>
          <div className="text-red-500">误报 ✗</div>
        </div>
        <div className="text-gray-500">预测跌</div>
        <div className="bg-red-900/40 rounded p-2">
          <div className="text-red-400 font-bold text-lg">{fn}</div>
          <div className="text-red-500">漏报 ✗</div>
        </div>
        <div className="bg-green-900/40 rounded p-2">
          <div className="text-green-400 font-bold text-lg">{tn}</div>
          <div className="text-green-500">正确 ✓</div>
        </div>
      </div>

      {/* 指标 */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-gray-400">准确率</div>
          <div className="text-blue-400 font-bold">{accuracy.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-gray-400">精确率</div>
          <div className="text-green-400 font-bold">{precision.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-gray-400">召回率</div>
          <div className="text-yellow-400 font-bold">{recall.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-gray-400">F1分数</div>
          <div className="text-purple-400 font-bold">{f1.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}