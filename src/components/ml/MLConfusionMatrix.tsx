'use client';

import React from 'react';

interface ConfusionMatrixProps {
  matrix: {
    truePos: number;  // 预测涨，实际涨
    falsePos: number; // 预测涨，实际跌
    falseNeg: number; // 预测跌，实际涨
    trueNeg: number;  // 预测跌，实际跌
  };
  total: number;
}

export function MLConfusionMatrix({ matrix, total }: ConfusionMatrixProps) {
  const { truePos, falsePos, falseNeg, trueNeg } = matrix;
  const accuracy = total > 0 ? ((truePos + trueNeg) / total * 100) : 0;
  const precision = (truePos + falsePos) > 0 ? (truePos / (truePos + falsePos) * 100) : 0;
  const recall = (truePos + falseNeg) > 0 ? (truePos / (truePos + falseNeg) * 100) : 0;
  const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  return (
    <div className="space-y-3">
      {/* 混淆矩阵 */}
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="text-gray-500">预测\实际</div>
        <div className="text-gray-500">实际涨</div>
        <div className="text-gray-500">实际跌</div>
        <div className="bg-green-900/40 rounded p-2">
          <div className="text-green-400 font-bold text-lg">{truePos}</div>
          <div className="text-green-500">预测涨 ✓</div>
        </div>
        <div className="bg-red-900/40 rounded p-2">
          <div className="text-red-400 font-bold text-lg">{falsePos}</div>
          <div className="text-red-500">预测涨 ✗</div>
        </div>
        <div className="bg-red-900/40 rounded p-2">
          <div className="text-red-400 font-bold text-lg">{falseNeg}</div>
          <div className="text-red-500">预测跌 ✗</div>
        </div>
        <div className="bg-green-900/40 rounded p-2">
          <div className="text-green-400 font-bold text-lg">{trueNeg}</div>
          <div className="text-green-500">预测跌 ✓</div>
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