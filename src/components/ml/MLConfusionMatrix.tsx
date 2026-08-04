'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { ConfusionMatrix } from '@/lib/ml/types';

interface Props {
  matrix: ConfusionMatrix;
}

export function MLConfusionMatrix({ matrix }: Props) {
  const { tp, fp, tn, fn } = matrix;
  const total = tp + fp + tn + fn;
  const accuracy = total > 0 ? ((tp + tn) / total * 100).toFixed(1) : '0.0';
  const precision = (tp + fp) > 0 ? (tp / (tp + fp) * 100).toFixed(1) : '0.0';
  const recall = (tp + fn) > 0 ? (tp / (tp + fn) * 100).toFixed(1) : '0.0';
  const specificity = (tn + fp) > 0 ? (tn / (tn + fp) * 100).toFixed(1) : '0.0';

  return (
    <Card>
      <CardContent className="pt-6">
        <h4 className="text-sm font-medium mb-4">混淆矩阵</h4>

        {/* 2x2 矩阵 */}
        <div className="grid grid-cols-2 gap-2 max-w-[300px] mx-auto mb-4">
          <div className="text-center p-2 rounded bg-emerald-900/30 border border-emerald-700/30">
            <div className="text-2xl font-bold text-emerald-400">{tn}</div>
            <div className="text-[11px] text-gray-400">实际跌<br/>预测跌</div>
          </div>
          <div className="text-center p-2 rounded bg-rose-900/30 border border-rose-700/30">
            <div className="text-2xl font-bold text-rose-400">{fp}</div>
            <div className="text-[11px] text-gray-400">实际跌<br/>预测涨</div>
          </div>
          <div className="text-center p-2 rounded bg-rose-900/30 border border-rose-700/30">
            <div className="text-2xl font-bold text-rose-400">{fn}</div>
            <div className="text-[11px] text-gray-400">实际涨<br/>预测跌</div>
          </div>
          <div className="text-center p-2 rounded bg-emerald-900/30 border border-emerald-700/30">
            <div className="text-2xl font-bold text-emerald-400">{tp}</div>
            <div className="text-[11px] text-gray-400">实际涨<br/>预测涨</div>
          </div>
        </div>

        {/* 指标行 */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <div className="text-gray-400">准确率</div>
            <div className="text-sm font-semibold text-blue-400">{accuracy}%</div>
          </div>
          <div>
            <div className="text-gray-400">精确率</div>
            <div className="text-sm font-semibold text-blue-400">{precision}%</div>
          </div>
          <div>
            <div className="text-gray-400">召回率</div>
            <div className="text-sm font-semibold text-blue-400">{recall}%</div>
          </div>
          <div>
            <div className="text-gray-400">特异度</div>
            <div className="text-sm font-semibold text-blue-400">{specificity}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}