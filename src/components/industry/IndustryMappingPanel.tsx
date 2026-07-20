"use client";

import { useState } from "react";

// 产业链映射关系（仅定义结构，不含数据值）
const INDUSTRY_CHAINS = [
  {
    id: "ai_compute",
    name: "AI算力链",
    foreignLeader: { name: "英伟达", code: "NVDA", market: "US" },
    aStocks: [
      { name: "中际旭创", code: "300308", relevance: "高" },
      { name: "寒武纪", code: "688256", relevance: "高" },
      { name: "中芯国际", code: "688981", relevance: "中" },
      { name: "海光信息", code: "688041", relevance: "高" },
    ],
    logic: "英伟达AI芯片需求强劲 → 国产算力替代加速 → 光模块/芯片设计公司受益",
  },
  {
    id: "consumer_electronics",
    name: "消费电子链",
    foreignLeader: { name: "苹果", code: "AAPL", market: "US" },
    aStocks: [
      { name: "立讯精密", code: "002475", relevance: "高" },
      { name: "歌尔股份", code: "002241", relevance: "高" },
      { name: "蓝思科技", code: "300433", relevance: "中" },
    ],
    logic: "苹果销量变化 → 供应链订单增减 → A股果链公司受影响",
  },
  {
    id: "new_energy",
    name: "新能源链",
    foreignLeader: { name: "特斯拉", code: "TSLA", market: "US" },
    aStocks: [
      { name: "宁德时代", code: "300750", relevance: "高" },
      { name: "比亚迪", code: "002594", relevance: "高" },
      { name: "亿纬锂能", code: "300014", relevance: "中" },
    ],
    logic: "特斯拉股价变化 → 新能源汽车景气度信号 → 电池/整车公司受影响",
  },
  {
    id: "semiconductor_jp",
    name: "半导体设备链(日本)",
    foreignLeader: { name: "东京电子", code: "8035.T", market: "JP" },
    aStocks: [
      { name: "北方华创", code: "002371", relevance: "高" },
      { name: "中微公司", code: "688012", relevance: "高" },
      { name: "拓荆科技", code: "688072", relevance: "中" },
    ],
    logic: "日本半导体设备商变化 → 全球半导体设备景气度信号 → 国产设备公司受影响",
  },
  {
    id: "storage_kr",
    name: "存储芯片链(韩国)",
    foreignLeader: { name: "三星电子", code: "005930.KS", market: "KR" },
    aStocks: [
      { name: "兆易创新", code: "603986", relevance: "高" },
      { name: "北京君正", code: "300223", relevance: "高" },
      { name: "江波龙", code: "301308", relevance: "中" },
    ],
    logic: "三星存储芯片价格变化 → 全球存储周期信号 → A股存储公司受影响",
  },
  {
    id: "display_kr",
    name: "面板链(韩国)",
    foreignLeader: { name: "三星显示", code: "Samsung Display", market: "KR" },
    aStocks: [
      { name: "京东方A", code: "000725", relevance: "高" },
      { name: "TCL科技", code: "000100", relevance: "高" },
      { name: "深天马A", code: "000050", relevance: "中" },
    ],
    logic: "韩国面板厂变化 → 全球面板价格信号 → A股面板公司受影响",
  },
];

interface IndustryMappingPanelProps {
  stockCode?: string;
}

export function IndustryMappingPanel({ stockCode }: IndustryMappingPanelProps) {
  const [expandedChain, setExpandedChain] = useState<string | null>(null);

  // 查找当前股票关联的产业链
  const relatedChains = stockCode 
    ? INDUSTRY_CHAINS.filter(chain => 
        chain.aStocks.some(s => s.code === stockCode)
      )
    : INDUSTRY_CHAINS;

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case "高": return "text-red-400 bg-red-500/10";
      case "中": return "text-yellow-400 bg-yellow-500/10";
      default: return "text-gray-400 bg-gray-500/10";
    }
  };

  const getMarketLabel = (market: string) => {
    switch (market) {
      case "US": return "🇺🇸";
      case "JP": return "🇯🇵";
      case "KR": return "🇰🇷";
      default: return "🌍";
    }
  };

  return (
    <div className="bg-[#0a0e17] border border-purple-500/30 rounded overflow-hidden">
      {/* 标题 */}
      <div className="px-3 py-2 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 text-sm">🔗</span>
            <span className="text-xs font-medium text-purple-400">产业链映射分析</span>
          </div>
          <span className="text-[10px] text-gray-500">
            {stockCode ? `关联 ${relatedChains.length} 条产业链` : `${INDUSTRY_CHAINS.length} 条产业链`}
          </span>
        </div>
      </div>

      {/* 产业链列表 */}
      <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
        {relatedChains.map(chain => (
          <div key={chain.id} className="border border-gray-800 rounded overflow-hidden">
            {/* 产业链标题 */}
            <div
              onClick={() => setExpandedChain(expandedChain === chain.id ? null : chain.id)}
              className="px-2 py-1.5 bg-[#111827] cursor-pointer hover:bg-[#1f2937] flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px]">{getMarketLabel(chain.foreignLeader.market)}</span>
                <span className="text-xs text-gray-300">{chain.name}</span>
                <span className="text-[10px] text-purple-400">
                  {chain.foreignLeader.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">
                  {chain.aStocks.length} 只A股
                </span>
                <span className="text-gray-500 text-[10px]">
                  {expandedChain === chain.id ? "▼" : "▶"}
                </span>
              </div>
            </div>

            {/* 展开内容 */}
            {expandedChain === chain.id && (
              <div className="px-2 py-2 bg-[#0f1419] space-y-2">
                {/* 传导逻辑 */}
                <div className="p-1.5 rounded bg-purple-500/5 border border-purple-500/20">
                  <span className="text-[10px] text-purple-400">传导逻辑: </span>
                  <span className="text-[10px] text-gray-400">{chain.logic}</span>
                </div>

                {/* 海外龙头 */}
                <div className="flex items-center justify-between p-1.5 rounded bg-[#1a1a2e]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]">{getMarketLabel(chain.foreignLeader.market)}</span>
                    <span className="text-[10px] text-gray-300">{chain.foreignLeader.name}</span>
                    <span className="text-[10px] text-gray-500">({chain.foreignLeader.code})</span>
                  </div>
                  <span className="text-[10px] text-gray-500">暂无数据</span>
                </div>

                {/* A股关联标的 */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500">A股关联标的:</span>
                  {chain.aStocks.map(stock => (
                    <div key={stock.code} className="flex items-center justify-between p-1 rounded hover:bg-[#1a1a2e]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-300">{stock.name}</span>
                        <span className="text-[10px] text-gray-500">({stock.code})</span>
                        <span className={`text-[9px] px-1 rounded ${getRelevanceColor(stock.relevance)}`}>
                          {stock.relevance}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">暂无数据</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
