"use client";

import { useState } from "react";

// 产业链映射关系
const INDUSTRY_CHAINS = [
  {
    id: "ai_compute",
    name: "AI算力链",
    foreignLeader: { name: "英伟达", code: "NVDA", market: "US", change: 3.5 },
    aStocks: [
      { name: "中际旭创", code: "300308", change: 5.2, relevance: "高" },
      { name: "寒武纪", code: "688256", change: 2.8, relevance: "高" },
      { name: "中芯国际", code: "688981", change: 1.5, relevance: "中" },
      { name: "海光信息", code: "688041", change: 4.1, relevance: "高" },
    ],
    logic: "英伟达AI芯片需求强劲 → 国产算力替代加速 → 光模块/芯片设计公司受益",
  },
  {
    id: "consumer_electronics",
    name: "消费电子链",
    foreignLeader: { name: "苹果", code: "AAPL", market: "US", change: -1.2 },
    aStocks: [
      { name: "立讯精密", code: "002475", change: -0.8, relevance: "高" },
      { name: "歌尔股份", code: "002241", change: -1.5, relevance: "高" },
      { name: "蓝思科技", code: "300433", change: -0.5, relevance: "中" },
    ],
    logic: "苹果销量下滑 → 供应链订单减少 → A股果链公司承压",
  },
  {
    id: "new_energy",
    name: "新能源链",
    foreignLeader: { name: "特斯拉", code: "TSLA", market: "US", change: 4.8 },
    aStocks: [
      { name: "宁德时代", code: "300750", change: 3.2, relevance: "高" },
      { name: "比亚迪", code: "002594", change: 2.5, relevance: "高" },
      { name: "亿纬锂能", code: "300014", change: 2.8, relevance: "中" },
    ],
    logic: "特斯拉股价上涨 → 新能源汽车景气度提升 → 电池/整车公司受益",
  },
  {
    id: "semiconductor_jp",
    name: "半导体设备链(日本)",
    foreignLeader: { name: "东京电子", code: "8035.T", market: "JP", change: 2.3 },
    aStocks: [
      { name: "北方华创", code: "002371", change: 1.8, relevance: "高" },
      { name: "中微公司", code: "688012", change: 2.1, relevance: "高" },
      { name: "拓荆科技", code: "688072", change: 1.5, relevance: "中" },
    ],
    logic: "日本半导体设备商上涨 → 全球半导体设备景气度提升 → 国产设备公司受益",
  },
  {
    id: "storage_kr",
    name: "存储芯片链(韩国)",
    foreignLeader: { name: "三星电子", code: "005930.KS", market: "KR", change: -2.1 },
    aStocks: [
      { name: "兆易创新", code: "603986", change: -1.5, relevance: "高" },
      { name: "北京君正", code: "300223", change: -1.8, relevance: "高" },
      { name: "江波龙", code: "301308", change: -1.2, relevance: "中" },
    ],
    logic: "三星存储芯片价格下跌 → 全球存储周期下行 → A股存储公司承压",
  },
  {
    id: "display_kr",
    name: "面板链(韩国)",
    foreignLeader: { name: "三星显示", code: "Samsung Display", market: "KR", change: 1.5 },
    aStocks: [
      { name: "京东方A", code: "000725", change: 1.2, relevance: "高" },
      { name: "TCL科技", code: "000100", change: 0.8, relevance: "高" },
      { name: "深天马A", code: "000050", change: 1.0, relevance: "中" },
    ],
    logic: "韩国面板厂涨价 → 全球面板价格上行 → A股面板公司受益",
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

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-red-400";
    if (change < 0) return "text-green-400";
    return "text-gray-400";
  };

  const getChangePrefix = (change: number) => {
    if (change > 0) return "+";
    return "";
  };

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case "高": return "text-red-400 bg-red-400/10";
      case "中": return "text-yellow-400 bg-yellow-400/10";
      default: return "text-gray-400 bg-gray-400/10";
    }
  };

  if (relatedChains.length === 0) {
    return (
      <div className="bg-[#0a0e17] border border-orange-500/30 rounded p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-orange-400 text-sm">🔗</span>
          <span className="text-xs font-medium text-orange-400">产业链映射</span>
        </div>
        <div className="text-[10px] text-gray-500">
          暂无关联产业链数据
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0e17] border border-orange-500/30 rounded overflow-hidden">
      {/* 标题 */}
      <div className="px-3 py-2 bg-gradient-to-r from-orange-500/10 to-transparent border-b border-orange-500/20">
        <div className="flex items-center gap-2">
          <span className="text-orange-400 text-sm">🔗</span>
          <span className="text-xs font-medium text-orange-400">产业链映射</span>
        </div>
        {stockCode && relatedChains.length > 0 && (
          <div className="text-[10px] text-gray-500 mt-1">
            发现 <span className="text-orange-400">{relatedChains.length}</span> 条关联产业链
          </div>
        )}
      </div>

      {/* 产业链列表 */}
      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
        {relatedChains.map(chain => (
          <div key={chain.id} className="border border-gray-800 rounded overflow-hidden">
            {/* 产业链标题 */}
            <div
              onClick={() => setExpandedChain(expandedChain === chain.id ? null : chain.id)}
              className="px-2 py-1.5 bg-[#111827] cursor-pointer hover:bg-[#1f2937] flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300">{chain.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono ${getChangeColor(chain.foreignLeader.change)}`}>
                  {chain.foreignLeader.name} {getChangePrefix(chain.foreignLeader.change)}{chain.foreignLeader.change}%
                </span>
                <span className="text-gray-500 text-[10px]">
                  {expandedChain === chain.id ? "▼" : "▶"}
                </span>
              </div>
            </div>

            {/* 展开内容 */}
            {expandedChain === chain.id && (
              <div className="px-2 py-2 bg-[#0f1419] space-y-2">
                {/* 映射逻辑 */}
                <div className="text-[10px] text-gray-400">
                  <span className="text-gray-500">映射逻辑: </span>
                  {chain.logic}
                </div>

                {/* A股关联标的 */}
                <div>
                  <div className="text-[10px] text-gray-500 mb-1">A股关联标的</div>
                  <div className="space-y-0.5">
                    {chain.aStocks.map((stock, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] py-0.5 px-1 rounded hover:bg-[#1f2937]/50">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300">{stock.name}</span>
                          <span className="text-gray-500">{stock.code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${getChangeColor(stock.change)}`}>
                            {getChangePrefix(stock.change)}{stock.change}%
                          </span>
                          <span className={`px-1 py-0.5 rounded text-[9px] ${getRelevanceColor(stock.relevance)}`}>
                            {stock.relevance}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 联动提示 */}
                <div className={`text-[10px] p-1.5 rounded ${
                  chain.foreignLeader.change > 2 
                    ? "bg-green-500/10 text-green-400" 
                    : chain.foreignLeader.change < -2
                    ? "bg-red-500/10 text-red-400"
                    : "bg-gray-500/10 text-gray-400"
                }`}>
                  {chain.foreignLeader.change > 2 && "📈 海外龙头大涨，今日A股相关标的可能有联动机会"}
                  {chain.foreignLeader.change < -2 && "📉 海外龙头大跌，注意A股相关标的联动风险"}
                  {chain.foreignLeader.change >= -2 && chain.foreignLeader.change <= 2 && "➡️ 海外龙头波动不大，关注盘中走势"}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
