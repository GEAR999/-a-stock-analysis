"use client";

import { useState, useEffect } from "react";
import { SentimentRow } from "@/components/SentimentTooltip";
import { fetchComprehensiveSentiment } from "@/services/sentiment/sentiment-panel";
import type { ComprehensiveSentiment } from "@/services/sentiment/types";
import { searchStocks } from "@/lib/api/stock";
import type { StockInfo } from "@/lib/types";

type ViewMode = "market" | "sector" | "stock";

// 预设板块列表
const PRESET_SECTORS = [
  { id: "ai", name: "AI算力" },
  { id: "semiconductor", name: "半导体" },
  { id: "biotech", name: "创新药" },
  { id: "newenergy", name: "新能源" },
  { id: "consumer", name: "消费" },
  { id: "finance", name: "金融" },
  { id: "military", name: "军工" },
  { id: "auto", name: "汽车" },
  { id: "realestate", name: "房地产" },
];

interface SentimentPanelProps {
  stockCode?: string;
  stockName?: string;
  sectorName?: string;
}

export function SentimentPanel({ stockCode, stockName, sectorName }: SentimentPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("market");
  const [data, setData] = useState<ComprehensiveSentiment | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 板块选择
  const [selectedSector, setSelectedSector] = useState(sectorName || "AI算力");
  
  // 个股选择
  const [selectedStockCode, setSelectedStockCode] = useState(stockCode || "600519");
  const [selectedStockName, setSelectedStockName] = useState(stockName || "贵州茅台");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // 搜索股票
  useEffect(() => {
    if (searchKeyword.length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await searchStocks(searchKeyword);
      setSearchResults(results.slice(0, 8));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // 加载情绪数据
  useEffect(() => {
    setLoading(true);
    const result = fetchComprehensiveSentiment(
      viewMode === "sector" ? selectedSector : undefined,
      viewMode === "stock" ? selectedStockCode : undefined
    );
    setData(result);
    setLoading(false);
  }, [viewMode, selectedSector, selectedStockCode]);

  // 选择股票
  const handleSelectStock = (stock: StockInfo) => {
    setSelectedStockCode(stock.code);
    setSelectedStockName(stock.name);
    setSearchKeyword("");
    setShowSearchDropdown(false);
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-xs">
        加载中...
      </div>
    );
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "极度贪婪":
      case "爆热":
        return "text-red-400";
      case "贪婪":
      case "热门":
        return "text-orange-400";
      case "中性":
      case "温和":
        return "text-yellow-400";
      case "恐慌":
      case "冷门":
        return "text-blue-400";
      case "极度恐慌":
        return "text-green-400";
      default:
        return "text-gray-400";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-400";
    if (score >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "低":
        return "text-green-400 bg-green-400/10";
      case "中":
        return "text-yellow-400 bg-yellow-400/10";
      case "高":
        return "text-orange-400 bg-orange-400/10";
      case "极高":
        return "text-red-400 bg-red-400/10";
      default:
        return "text-gray-400 bg-gray-400/10";
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0e17]">
      {/* 视图切换 */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-800">
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
          className="flex-1 bg-[#111827] border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="market">大盘情绪</option>
          <option value="sector">板块热度</option>
          <option value="stock">个股情绪</option>
        </select>
      </div>

      {/* 板块选择 */}
      {viewMode === "sector" && (
        <div className="p-2 border-b border-gray-800">
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="w-full bg-[#111827] border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {PRESET_SECTORS.map((sector) => (
              <option key={sector.id} value={sector.name}>
                {sector.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 个股选择 */}
      {viewMode === "stock" && (
        <div className="p-2 border-b border-gray-800 relative">
          <div className="relative">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              placeholder={`搜索股票 (当前: ${selectedStockName})`}
              className="w-full bg-[#111827] border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            />
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-gray-700 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                {searchResults.map((stock) => (
                  <button
                    key={stock.code}
                    onClick={() => handleSelectStock(stock)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-[#2a2a3e] flex items-center justify-between"
                  >
                    <span className="text-gray-200">{stock.name}</span>
                    <span className="text-gray-500">{stock.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-1.5 text-[10px] text-gray-500">
            当前: {selectedStockName} ({selectedStockCode})
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 综合评分卡片 */}
        <div className="bg-[#1a1a2e] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">综合评分</span>
            <span className={`text-[10px] px-2 py-0.5 rounded ${getRiskColor(data.riskLevel)}`}>
              风险: {data.riskLevel}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-mono font-bold ${getScoreColor(data.overallScore)}`}>
              {data.overallScore}
            </span>
            <span className="text-gray-500 text-xs mb-1">/100</span>
          </div>
          <p className="text-gray-400 text-[11px] mt-2 leading-relaxed break-words">
            {data.suggestion}
          </p>
        </div>

        {/* 大盘情绪 */}
        {viewMode === "market" && (
          <div className="bg-[#1a1a2e] rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-200">大盘情绪</h3>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-mono font-bold ${getScoreColor(data.market.score)}`}>
                  {data.market.score}
                </span>
                <span className={`text-xs ${getLevelColor(data.market.level)}`}>
                  {data.market.level}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              {data.market.details.map((detail) => (
                <SentimentRow key={detail.name} detail={detail} />
              ))}
            </div>
          </div>
        )}

        {/* 板块热度 */}
        {viewMode === "sector" && (
          <div className="bg-[#1a1a2e] rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-200">
                板块热度
                <span className="text-gray-400 text-xs ml-2">({selectedSector})</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-mono font-bold ${getScoreColor(data.sector.score)}`}>
                  {data.sector.score}
                </span>
                <span className={`text-xs ${getLevelColor(data.sector.level)}`}>
                  {data.sector.level}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              {data.sector.details.map((detail) => (
                <SentimentRow key={detail.name} detail={detail} />
              ))}
            </div>
          </div>
        )}

        {/* 个股情绪 */}
        {viewMode === "stock" && (
          <div className="bg-[#1a1a2e] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-200">
                个股情绪
                <span className="text-gray-400 text-xs ml-2">({selectedStockName})</span>
              </h3>
              <span className={`text-lg font-mono font-bold ${getScoreColor(data.stock.score)}`}>
                {data.stock.score}
              </span>
            </div>
            {/* 标签 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {data.stock.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="space-y-1.5">
              {data.stock.details.map((detail) => (
                <SentimentRow key={detail.name} detail={detail} />
              ))}
            </div>
          </div>
        )}

        {/* 其他维度概览 */}
        <div className="bg-[#1a1a2e] rounded-lg p-3">
          <h4 className="text-xs text-gray-400 mb-2">其他维度</h4>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setViewMode("market")}
              className={`p-2 rounded text-center ${
                viewMode === "market" ? "bg-blue-500/20 border border-blue-500/50" : "bg-[#0f0f1a]"
              }`}
            >
              <div className={`text-lg font-mono font-bold ${getScoreColor(data.market.score)}`}>
                {data.market.score}
              </div>
              <div className="text-[10px] text-gray-400">大盘</div>
            </button>
            <button
              onClick={() => setViewMode("sector")}
              className={`p-2 rounded text-center ${
                viewMode === "sector" ? "bg-blue-500/20 border border-blue-500/50" : "bg-[#0f0f1a]"
              }`}
            >
              <div className={`text-lg font-mono font-bold ${getScoreColor(data.sector.score)}`}>
                {data.sector.score}
              </div>
              <div className="text-[10px] text-gray-400">板块</div>
            </button>
            <button
              onClick={() => setViewMode("stock")}
              className={`p-2 rounded text-center ${
                viewMode === "stock" ? "bg-blue-500/20 border border-blue-500/50" : "bg-[#0f0f1a]"
              }`}
            >
              <div className={`text-lg font-mono font-bold ${getScoreColor(data.stock.score)}`}>
                {data.stock.score}
              </div>
              <div className="text-[10px] text-gray-400">个股</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
