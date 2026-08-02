'use client';

import React from 'react';

interface PredictionHistoryProps {
  predictions: {
    date: string;
    actual: number;  // 1涨 0跌
    predicted: number; // 0-1概率
    confidence: number; // 0-1
  }[];
}

export function MLPredictionHistory({ predictions }: PredictionHistoryProps) {
  const recent = predictions.slice(-30);
  const correct = recent.filter(p => (p.predicted >= 0.5 ? 1 : 0) === p.actual);
  const accuracy = recent.length > 0 ? (correct.length / recent.length * 100) : 0;

  // 高置信度预测准确率
  const highConf = recent.filter(p => p.confidence > 0.7);
  const highCorrect = highConf.filter(p => (p.predicted >= 0.5 ? 1 : 0) === p.actual);
  const highAcc = highConf.length > 0 ? (highCorrect.length / highConf.length * 100) : 0;

  return (
    <div className="space-y-3">
      {/* 统计概览 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-gray-400">最近{recent.length}次准确率</div>
          <div className="text-blue-400 font-bold text-sm">{accuracy.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-gray-400">{'高置信度(>70%)准确率'}</div>
          <div className="text-green-400 font-bold text-sm">
            {highConf.length > 0 ? `${highAcc.toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>

      {/* 预测历史条 */}
      <div className="space-y-1">
        {recent.slice(-20).map((p, i) => {
          const isCorrect = (p.predicted >= 0.5 ? 1 : 0) === p.actual;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 w-16 flex-shrink-0">{p.date.slice(5)}</span>
              {/* 概率条 */}
              <div className="flex-1 bg-gray-700 rounded-full h-3 relative">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${p.predicted * 100}%`,
                    backgroundColor: p.predicted >= 0.5 ? '#3B82F6' : '#EF4444',
                    opacity: p.confidence > 0.7 ? 1 : 0.5,
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono"
                  style={{ color: p.predicted > 0.5 ? '#fff' : '#fff' }}>
                  {(p.predicted * 100).toFixed(0)}%
                </span>
              </div>
              <span className={`w-3 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {isCorrect ? '✓' : '✗'}
              </span>
              <span className={`w-6 ${p.actual === 1 ? 'text-red-400' : 'text-green-400'}`}>
                {p.actual === 1 ? '↑' : '↓'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}