'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface FeatureImportance {
  name: string;
  importance: number;
  rank: number;
}

interface Props {
  features: FeatureImportance[];
}

const FEATURE_NAMES = [
  '涨跌幅', '振幅', '实体比例', '上影线', '下影线',
  '量比', '5日均量', '10日均量',
  'MA5偏离', 'MA10偏离', 'MA20偏离', 'MA60偏离', 'MA120偏离', 'MA250偏离',
  'MACD柱', 'MACD_DIF', 'MACD_DEA', 'RSI', 'KDJ_K', 'KDJ_D', 'KDJ_J',
  '布林位置', '布林带宽', 'WR',
  '连涨天数', '月份Sin', '月份Cos', '季度末',
  'RSI×布林', 'MACD×量', '涨跌×连涨', '实体×量比', '振幅×ATR', 'RSI×WR',
  '指数编码×7',
];

export function MLFeatureImportance({ features }: Props) {
  if (!features || features.length === 0) return null;

  const sorted = [...features]
    .map((f, i) => ({ name: FEATURE_NAMES[i] || `特征${i}`, importance: f.importance, rank: i + 1 }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 15);

  const maxImportance = Math.max(...sorted.map((f) => f.importance), 0.001);

  return (
    <Card>
      <CardContent className="pt-6">
        <h4 className="text-sm font-medium mb-3">特征重要性 Top 15</h4>
        <div className="space-y-1.5">
          {sorted.map((f, i) => (
            <div key={f.name} className="flex items-center gap-3">
              {/* 排名 */}
              <span className={`text-xs font-mono w-5 text-right ${
                i < 3 ? 'text-yellow-400' : i < 5 ? 'text-blue-400' : 'text-gray-500'
              }`}>
                #{i + 1}
              </span>
              {/* 名称 */}
              <span className="text-xs text-gray-300 w-20 truncate flex-shrink-0">{f.name}</span>
              {/* 条形图 */}
              <div className="flex-1 h-4 bg-gray-800 rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm transition-all duration-500 ${
                    i < 3 ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
                    i < 5 ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
                    'bg-gradient-to-r from-gray-600 to-gray-400'
                  }`}
                  style={{ width: `${(f.importance / maxImportance) * 100}%` }}
                />
              </div>
              {/* 数值 */}
              <span className="text-xs font-mono text-gray-400 w-12 text-right">
                {(f.importance * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}