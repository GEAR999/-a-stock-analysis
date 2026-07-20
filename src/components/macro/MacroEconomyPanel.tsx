"use client";

import { useState } from "react";

// 经济体结构定义（不含硬编码数据值）
const ECONOMIES = [
  {
    id: "china",
    name: "中国",
    flag: "🇨🇳",
    impact: 5,
    impactLabel: "决定性",
    indicatorNames: ["GDP同比", "PMI", "CPI", "PPI", "社融增量", "M2增速"],
  },
  {
    id: "us",
    name: "美国",
    flag: "🇺🇸",
    impact: 5,
    impactLabel: "重要",
    indicatorNames: ["联邦基金利率", "CPI", "核心PCE", "非农就业", "失业率", "GDP"],
  },
  {
    id: "europe",
    name: "欧洲",
    flag: "🇪🇺",
    impact: 3,
    impactLabel: "一般",
    indicatorNames: ["ECB利率", "欧元区GDP", "CPI"],
  },
  {
    id: "japan",
    name: "日本",
    flag: "🇯🇵",
    impact: 4,
    impactLabel: "较重要",
    indicatorNames: ["BOJ利率", "日元汇率", "日经指数"],
  },
  {
    id: "korea",
    name: "韩国",
    flag: "🇰🇷",
    impact: 4,
    impactLabel: "较重要",
    indicatorNames: ["BOK利率", "三星电子", "出口增速"],
  },
];

interface MacroEconomyPanelProps {
  enabled: boolean;
}

export function MacroEconomyPanel({ enabled }: MacroEconomyPanelProps) {
  const [expandedEconomy, setExpandedEconomy] = useState<string | null>("china");

  if (!enabled) return null;

  const getImpactStars = (impact: number) => {
    return "★".repeat(impact) + "☆".repeat(5 - impact);
  };

  return (
    <div className="bg-[#0a0e17] border border-amber-500/30 rounded overflow-hidden">
      {/* 标题 */}
      <div className="px-3 py-2 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-amber-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">🌐</span>
            <span className="text-xs font-medium text-amber-400">宏观经济分析</span>
          </div>
          <span className="text-[10px] text-gray-500">
            综合评级: <span className="text-gray-500">暂无数据</span>
          </span>
        </div>
      </div>

      {/* 经济体列表 */}
      <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
        {ECONOMIES.map(economy => (
          <div key={economy.id} className="border border-gray-800 rounded overflow-hidden">
            {/* 经济体标题 */}
            <div
              onClick={() => setExpandedEconomy(expandedEconomy === economy.id ? null : economy.id)}
              className="px-2 py-1.5 bg-[#111827] cursor-pointer hover:bg-[#1f2937] flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{economy.flag}</span>
                <span className="text-xs text-gray-300">{economy.name}</span>
                <span className="text-[10px] text-amber-400">{getImpactStars(economy.impact)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-[10px]">
                  {expandedEconomy === economy.id ? "▼" : "▶"}
                </span>
              </div>
            </div>

            {/* 展开内容 */}
            {expandedEconomy === economy.id && (
              <div className="px-2 py-2 bg-[#0f1419] space-y-2">
                {/* 经济指标表格 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="text-left py-1 pr-2">指标</th>
                        <th className="text-right py-1 px-1">当前</th>
                        <th className="text-right py-1 px-1">前值</th>
                        <th className="text-right py-1 px-1">预期</th>
                        <th className="text-center py-1 pl-1">趋势</th>
                      </tr>
                    </thead>
                    <tbody>
                      {economy.indicatorNames.map((name, i) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          <td className="py-1 pr-2 text-gray-400">{name}</td>
                          <td className="py-1 px-1 text-right text-gray-500">暂无数据</td>
                          <td className="py-1 px-1 text-right text-gray-500">暂无数据</td>
                          <td className="py-1 px-1 text-right text-gray-500">暂无数据</td>
                          <td className="py-1 pl-1 text-center text-gray-500">-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 政策与描述 */}
                <div className="space-y-1 pt-1 border-t border-gray-800">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-gray-500 shrink-0">政策:</span>
                    <span className="text-[10px] text-gray-500">暂无数据</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-gray-500 shrink-0">概况:</span>
                    <span className="text-[10px] text-gray-500">暂无数据</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 综合评估 */}
      <div className="p-2 border-t border-amber-500/20 bg-[#0f1419]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-amber-400">📊</span>
          <span className="text-xs text-amber-400 font-medium">综合评估</span>
        </div>
        <div className="space-y-1 text-[10px]">
          <div className="flex items-start gap-2">
            <span className="text-gray-500 shrink-0">结论:</span>
            <span className="text-gray-500">暂无数据</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-500 shrink-0">策略:</span>
            <span className="text-gray-500">暂无数据</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-500 shrink-0">风险:</span>
            <span className="text-gray-500">暂无数据</span>
          </div>
        </div>
      </div>
    </div>
  );
}
