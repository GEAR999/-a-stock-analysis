'use client';

import React from 'react';
import type { PredictionHistoryItem } from '@/lib/ml/types';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  predictions: PredictionHistoryItem[];
}

export function MLPredictionHistory({ predictions }: Props) {
  if (predictions.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-3">暂无预测历史</div>
    );
  }

  const recent = predictions.slice(-30);
  const correct = recent.filter(p => (p.upProb >= 0.5 ? 1 : 0) === p.actual);
  const accuracy = recent.length > 0 ? (correct.length / recent.length * 100) : 0;

  // 高置信度预测准确率
  const highConf = recent.filter(p => Math.abs(p.upProb - 0.5) > 0.2);
  const highCorrect = highConf.filter(p => (p.upProb >= 0.5 ? 1 : 0) === p.actual);
  const highAcc = highConf.length > 0 ? (highCorrect.length / highConf.length * 100) : 0;

  return (
    <Card className="border border-white/5">
      <CardContent className="pt-6">
        <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-purple-500 rounded-full" />
          预测历史
        </h4>

        {/* 统计概览 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-white/5">
            <div className="text-xs text-gray-500 mb-1">最近{recent.length}次准确率</div>
            <div className="text-lg font-bold text-blue-400 font-mono tabular-nums">{accuracy.toFixed(1)}%</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-white/5">
            <div className="text-xs text-gray-500 mb-1">高置信度(&gt;70%)准确率</div>
            <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">
              {highConf.length > 0 ? `${highAcc.toFixed(1)}%` : '--'}
            </div>
          </div>
        </div>

        {/* 预测历史条 */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin">
          {recent.slice(-20).reverse().map((p, i) => {
            const isCorrect = (p.upProb >= 0.5 ? 1 : 0) === p.actual;
            const barColor = p.upProb >= 0.5 ? 'bg-gradient-to-r from-blue-500 to-blue-400' : 'bg-gradient-to-r from-rose-500 to-rose-400';
            return (
              <div key={i} className="flex items-center gap-2 text-xs py-1 hover:bg-white/5 rounded px-1 transition-colors">
                <span className="text-gray-500 w-16 flex-shrink-0 font-mono">{p.date.slice(5)}</span>
                {/* 概率条 */}
                <div className="flex-1 bg-gray-700/50 rounded-full h-3.5 relative overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{
                      width: `${p.upProb * 100}%`,
                      opacity: Math.abs(p.upProb - 0.5) > 0.2 ? 1 : 0.5,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/90 font-medium">
                    {(p.upProb * 100).toFixed(0)}%
                  </span>
                </div>
                <span className={`w-4 text-center font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isCorrect ? '✓' : '✗'}
                </span>
                <span className={`w-5 text-center font-bold ${p.actual === 1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {p.actual === 1 ? '↑' : '↓'}
                </span>
              </div>
            );
          })}
        </div>

        {recent.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-3">暂无预测历史数据</div>
        )}
      </CardContent>
    </Card>
  );
}