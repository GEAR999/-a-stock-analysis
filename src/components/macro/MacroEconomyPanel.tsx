"use client";

import { useState } from "react";

// 经济体数据
const ECONOMIES = [
  {
    id: "china",
    name: "中国",
    flag: "🇨🇳",
    impact: 5,
    impactLabel: "决定性",
    status: "扩张",
    statusColor: "text-green-400",
    impactOnA: "利好",
    impactColor: "text-green-400",
    indicators: [
      { name: "GDP同比", value: "5.2%", prev: "4.9%", expect: "5.0%", trend: "up" },
      { name: "PMI", value: "50.8", prev: "50.2", expect: "50.5", trend: "up" },
      { name: "CPI", value: "0.3%", prev: "0.2%", expect: "0.4%", trend: "down" },
      { name: "PPI", value: "-2.5%", prev: "-2.7%", expect: "-2.3%", trend: "up" },
      { name: "社融增量", value: "2.8万亿", prev: "2.5万亿", expect: "2.6万亿", trend: "up" },
      { name: "M2增速", value: "9.7%", prev: "9.5%", expect: "9.6%", trend: "up" },
    ],
    policy: "货币政策稳健偏松，LPR维持不变，降准预期升温",
    description: "经济复苏态势延续，内需逐步恢复，政策持续发力",
  },
  {
    id: "us",
    name: "美国",
    flag: "🇺🇸",
    impact: 5,
    impactLabel: "重要",
    status: "中性",
    statusColor: "text-yellow-400",
    impactOnA: "中性偏空",
    impactColor: "text-yellow-400",
    indicators: [
      { name: "联邦基金利率", value: "5.50%", prev: "5.50%", expect: "5.25%", trend: "flat" },
      { name: "CPI", value: "3.1%", prev: "3.2%", expect: "3.0%", trend: "down" },
      { name: "核心PCE", value: "2.8%", prev: "2.9%", expect: "2.7%", trend: "down" },
      { name: "非农就业", value: "21.6万", prev: "17.3万", expect: "20.0万", trend: "up" },
      { name: "失业率", value: "3.7%", prev: "3.8%", expect: "3.8%", trend: "down" },
      { name: "GDP", value: "3.2%", prev: "2.1%", expect: "2.8%", trend: "up" },
    ],
    policy: "美联储维持高利率，降息预期推迟，美元指数偏强",
    description: "通胀回落但核心通胀仍高，就业市场强劲，软着陆预期增强",
    transmission: "通过北向资金、汇率、风险偏好传导至A股",
  },
  {
    id: "europe",
    name: "欧洲",
    flag: "🇪🇺",
    impact: 3,
    impactLabel: "一般",
    status: "收缩",
    statusColor: "text-red-400",
    impactOnA: "中性",
    impactColor: "text-gray-400",
    indicators: [
      { name: "ECB利率", value: "4.50%", prev: "4.50%", expect: "4.25%", trend: "flat" },
      { name: "欧元区GDP", value: "0.1%", prev: "0.0%", expect: "0.2%", trend: "up" },
      { name: "CPI", value: "2.9%", prev: "3.1%", expect: "2.8%", trend: "down" },
    ],
    policy: "ECB维持利率不变，经济增长乏力，关注欧债风险",
    description: "经济接近停滞，通胀逐步回落，地缘政治风险仍存",
    transmission: "间接影响，通过全球风险偏好和出口需求传导",
  },
  {
    id: "japan",
    name: "日本",
    flag: "🇯🇵",
    impact: 4,
    impactLabel: "较重要",
    status: "扩张",
    statusColor: "text-green-400",
    impactOnA: "中性偏多",
    impactColor: "text-green-400",
    indicators: [
      { name: "BOJ利率", value: "-0.10%", prev: "-0.10%", expect: "-0.10%", trend: "flat" },
      { name: "日元汇率", value: "148.5", prev: "149.2", expect: "147.0", trend: "up" },
      { name: "日经指数", value: "38,500", prev: "37,800", expect: "-", trend: "up" },
    ],
    policy: "日本央行维持超宽松政策，YCC调整预期延后",
    description: "经济温和复苏，企业盈利改善，日元贬值利好出口",
    transmission: "产业链竞争、资金流向、汇率套利影响A股",
  },
  {
    id: "korea",
    name: "韩国",
    flag: "🇰🇷",
    impact: 4,
    impactLabel: "较重要",
    status: "中性",
    statusColor: "text-yellow-400",
    impactOnA: "中性",
    impactColor: "text-gray-400",
    indicators: [
      { name: "BOK利率", value: "3.50%", prev: "3.50%", expect: "3.25%", trend: "flat" },
      { name: "三星电子", value: "72,500", prev: "71,200", expect: "-", trend: "up" },
      { name: "出口增速", value: "-4.2%", prev: "-5.1%", expect: "-3.0%", trend: "up" },
    ],
    policy: "韩国央行维持利率不变，半导体周期底部回升",
    description: "半导体周期触底，出口逐步恢复，内需仍偏弱",
    transmission: "半导体产业链映射，影响A股存储芯片、面板等板块",
  },
];

// 综合评估
const MACRO_ASSESSMENT = {
  rating: "中性",
  ratingColor: "text-yellow-400",
  risks: [
    "美联储维持高利率时间超预期",
    "地缘政治冲突升级风险",
    "国内经济复苏不及预期",
  ],
  conclusion: "全球宏观环境中性，国内经济复苏态势延续，政策持续发力支撑市场",
  strategy: "结构配置为主，关注政策受益板块和业绩确定性强的个股",
};

interface MacroEconomyPanelProps {
  enabled: boolean;
}

export function MacroEconomyPanel({ enabled }: MacroEconomyPanelProps) {
  const [expandedEconomy, setExpandedEconomy] = useState<string | null>("china");

  if (!enabled) return null;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <span className="text-green-400">↑</span>;
      case "down":
        return <span className="text-red-400">↓</span>;
      default:
        return <span className="text-gray-400">→</span>;
    }
  };

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
            综合评级: <span className={MACRO_ASSESSMENT.ratingColor}>{MACRO_ASSESSMENT.rating}</span>
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
                <span className={`text-[10px] ${economy.statusColor}`}>{economy.status}</span>
                <span className="text-gray-500 text-[10px]">
                  {expandedEconomy === economy.id ? "▼" : "▶"}
                </span>
              </div>
            </div>

            {/* 展开内容 */}
            {expandedEconomy === economy.id && (
              <div className="px-2 py-2 bg-[#0f1419] space-y-2">
                {/* 状态和影响 */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">对A股影响:</span>
                  <span className={economy.impactColor}>{economy.impactOnA}</span>
                </div>

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
                      {economy.indicators.map((ind, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-[#1f2937]/50">
                          <td className="py-1 pr-2 text-gray-400">{ind.name}</td>
                          <td className="py-1 px-1 text-right font-mono text-gray-300">{ind.value}</td>
                          <td className="py-1 px-1 text-right font-mono text-gray-500">{ind.prev}</td>
                          <td className="py-1 px-1 text-right font-mono text-gray-500">{ind.expect}</td>
                          <td className="py-1 pl-1 text-center">{getTrendIcon(ind.trend)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 政策描述 */}
                <div className="text-[10px] text-gray-400">
                  <span className="text-gray-500">政策: </span>
                  {economy.policy}
                </div>

                {/* 传导路径 */}
                {economy.transmission && (
                  <div className="text-[10px] text-blue-400/80">
                    <span className="text-gray-500">传导: </span>
                    {economy.transmission}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 综合评估 */}
      <div className="px-3 py-2 border-t border-gray-800 bg-[#0f1419]">
        <div className="text-[10px] text-gray-500 mb-1">综合评估</div>
        <div className="text-[10px] text-gray-300 mb-2">{MACRO_ASSESSMENT.conclusion}</div>
        
        <div className="text-[10px] text-gray-500 mb-1">主要风险</div>
        <div className="space-y-0.5 mb-2">
          {MACRO_ASSESSMENT.risks.map((risk, i) => (
            <div key={i} className="text-[10px] text-red-400/80 flex items-center gap-1">
              <span>⚠</span>
              <span>{risk}</span>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-gray-500 mb-1">应对策略</div>
        <div className="text-[10px] text-green-400/80">{MACRO_ASSESSMENT.strategy}</div>
      </div>
    </div>
  );
}
