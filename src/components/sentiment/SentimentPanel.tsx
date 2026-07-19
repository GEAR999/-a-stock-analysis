"use client";

import { useState, useEffect } from "react";
import { SentimentRow } from "@/components/SentimentTooltip";
import { fetchComprehensiveSentiment } from "@/services/sentiment/sentiment-panel";
import type { ComprehensiveSentiment } from "@/services/sentiment/types";
import { searchStocks } from "@/lib/api/stock";
import type { StockInfo } from "@/lib/types";

type ViewMode = "market" | "sector" | "stock";

// 全市场板块列表（申万行业分类）
const MARKET_SECTORS = [
  // 一级行业
  { id: "801010", name: "农林牧渔", type: "industry" },
  { id: "801020", name: "采掘", type: "industry" },
  { id: "801030", name: "化工", type: "industry" },
  { id: "801040", name: "钢铁", type: "industry" },
  { id: "801050", name: "有色金属", type: "industry" },
  { id: "801080", name: "电子", type: "industry" },
  { id: "801110", name: "家用电器", type: "industry" },
  { id: "801120", name: "食品饮料", type: "industry" },
  { id: "801140", name: "纺织服饰", type: "industry" },
  { id: "801150", name: "轻工制造", type: "industry" },
  { id: "801160", name: "医药生物", type: "industry" },
  { id: "801170", name: "交通运输", type: "industry" },
  { id: "801180", name: "房地产", type: "industry" },
  { id: "801200", name: "商贸零售", type: "industry" },
  { id: "801230", name: "综合", type: "industry" },
  { id: "801710", name: "建筑材料", type: "industry" },
  { id: "801720", name: "建筑装饰", type: "industry" },
  { id: "801730", name: "电力设备", type: "industry" },
  { id: "801750", name: "国防军工", type: "industry" },
  { id: "801760", name: "计算机", type: "industry" },
  { id: "801770", name: "传媒", type: "industry" },
  { id: "801780", name: "银行", type: "industry" },
  { id: "801790", name: "非银金融", type: "industry" },
  { id: "801880", name: "汽车", type: "industry" },
  { id: "801890", name: "机械设备", type: "industry" },
  { id: "801950", name: "煤炭", type: "industry" },
  { id: "801960", name: "石油石化", type: "industry" },
  { id: "801970", name: "环保", type: "industry" },
  { id: "801980", name: "美容护理", type: "industry" },
  { id: "801990", name: "公用事业", type: "industry" },
  // 热门概念板块
  { id: "concept_ai", name: "AI算力", type: "concept" },
  { id: "concept_chip", name: "半导体", type: "concept" },
  { id: "concept_biotech", name: "创新药", type: "concept" },
  { id: "concept_ev", name: "新能源汽车", type: "concept" },
  { id: "concept_pv", name: "光伏", type: "concept" },
  { id: "concept_battery", name: "锂电池", type: "concept" },
  { id: "concept_robot", name: "机器人", type: "concept" },
  { id: "concept_metaverse", name: "元宇宙", type: "concept" },
  { id: "concept_web3", name: "Web3.0", type: "concept" },
  { id: "concept_digital", name: "数字经济", type: "concept" },
  { id: "concept_carbon", name: "碳中和", type: "concept" },
  { id: "concept_military", name: "军工", type: "concept" },
  { id: "concept_consumer", name: "消费升级", type: "concept" },
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
  const [sectorSearch, setSectorSearch] = useState("");
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);
  
  // 个股选择
  const [followCurrentStock, setFollowCurrentStock] = useState(true);
  const [selectedStockCode, setSelectedStockCode] = useState(stockCode || "600519");
  const [selectedStockName, setSelectedStockName] = useState(stockName || "贵州茅台");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // 搜索股票
  useEffect(() => {
    if (searchKeyword.length < 1 || followCurrentStock) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await searchStocks(searchKeyword);
      setSearchResults(results.slice(0, 8));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword, followCurrentStock]);

  // 加载情绪数据 - 从API获取实时数据
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let url = '/api/stock?action=';
        if (viewMode === 'market') {
          url += 'comprehensive_sentiment';
        } else if (viewMode === 'sector') {
          url += `sector_sentiment&sector=${encodeURIComponent(selectedSector)}`;
        } else {
          url += `stock_sentiment&code=${selectedStockCode}`;
        }
        
        const response = await fetch(url);
        const json = await response.json();
        
        if (json.success && json.data) {
          // For market view, the API returns comprehensive sentiment
          if (viewMode === 'market') {
            setData(json.data);
          } else if (viewMode === 'sector') {
            // Transform sector data to ComprehensiveSentiment format
            const sectorResult = json.data as { score: number; level: string; details: Array<{ name: string; score: number; weight: number; value: string; description: string; calculation: string; impact: string }> };
            setData({
              market: { score: 50, level: '中性' as const, details: [] },
              sector: { score: sectorResult.score, level: sectorResult.level as '爆热' | '热门' | '温和' | '冷门', details: sectorResult.details },
              stock: { score: 50, tags: [], details: [] },
              overallScore: sectorResult.score,
              suggestion: '根据板块热度调整配置',
              riskLevel: '中' as const,
              composite: { score: sectorResult.score, level: sectorResult.level, description: '板块情绪分析' },
            });
          } else if (viewMode === 'stock') {
            // Transform stock data to ComprehensiveSentiment format
            const stockResult = json.data as { score: number; tags: string[]; details: Array<{ name: string; score: number; weight: number; value: string; description: string; calculation: string; impact: string }> };
            setData({
              market: { score: 50, level: '中性' as const, details: [] },
              sector: { score: 50, level: '温和' as const, details: [] },
              stock: { score: stockResult.score, tags: stockResult.tags, details: stockResult.details },
              overallScore: stockResult.score,
              suggestion: '根据个股情绪调整仓位',
              riskLevel: '中' as const,
              composite: { score: stockResult.score, level: '中性', description: '个股情绪分析' },
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch sentiment:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [viewMode, selectedSector, selectedStockCode]);

  // 选择股票
  const handleSelectStock = (stock: StockInfo) => {
    setSelectedStockCode(stock.code);
    setSelectedStockName(stock.name);
    setSearchKeyword("");
    setShowSearchDropdown(false);
  };

  // 过滤板块列表
  const filteredSectors = MARKET_SECTORS.filter(s => 
    s.name.toLowerCase().includes(sectorSearch.toLowerCase()) ||
    s.id.includes(sectorSearch)
  );

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

      {/* 板块选择器 */}
      {viewMode === "sector" && (
        <div className="p-2 border-b border-gray-800">
          <div className="relative">
            <input
              type="text"
              value={sectorSearch}
              onChange={(e) => {
                setSectorSearch(e.target.value);
                setShowSectorDropdown(true);
              }}
              onFocus={() => setShowSectorDropdown(true)}
              placeholder="搜索板块..."
              className="w-full bg-[#111827] border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            />
            {showSectorDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#111827] border border-gray-700 rounded z-10">
                {filteredSectors.map(sector => (
                  <div
                    key={sector.id}
                    onClick={() => {
                      setSelectedSector(sector.name);
                      setShowSectorDropdown(false);
                      setSectorSearch("");
                    }}
                    className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-[#1f2937] flex items-center gap-2 ${
                      selectedSector === sector.name ? "bg-blue-500/20 text-blue-400" : "text-gray-300"
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${sector.type === "industry" ? "bg-blue-400" : "bg-purple-400"}`} />
                    <span>{sector.name}</span>
                    <span className="text-gray-500 text-[10px] ml-auto">
                      {sector.type === "industry" ? "行业" : "概念"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-1 text-[10px] text-gray-500">
            当前: <span className="text-blue-400">{selectedSector}</span>
          </div>
        </div>
      )}

      {/* 个股选择器 */}
      {viewMode === "stock" && (
        <div className="p-2 border-b border-gray-800">
          {/* 跟随开关 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">跟随当前股票</span>
            <button
              onClick={() => setFollowCurrentStock(!followCurrentStock)}
              className={`relative w-8 h-4 rounded-full transition-colors ${
                followCurrentStock ? "bg-blue-500" : "bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  followCurrentStock ? "left-4.5" : "left-0.5"
                }`}
              />
            </button>
          </div>
          
          {/* 搜索框（非跟随模式时显示） */}
          {!followCurrentStock && (
            <div className="relative">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="输入股票代码或名称..."
                className="w-full bg-[#111827] border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
              />
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-[#111827] border border-gray-700 rounded z-10">
                  {searchResults.map(stock => (
                    <div
                      key={stock.code}
                      onClick={() => handleSelectStock(stock)}
                      className="px-2 py-1.5 text-xs cursor-pointer hover:bg-[#1f2937] text-gray-300 flex justify-between"
                    >
                      <span>{stock.name}</span>
                      <span className="text-gray-500">{stock.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="mt-1 text-[10px] text-gray-500">
            当前: <span className="text-blue-400">{selectedStockName}</span>
            {followCurrentStock && <span className="text-green-400 ml-1">(自动跟随)</span>}
          </div>
        </div>
      )}

      {/* 综合评分卡片 */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">
            {viewMode === "market" && "大盘情绪"}
            {viewMode === "sector" && "板块热度"}
            {viewMode === "stock" && "个股情绪"}
          </span>
          <span className={`text-lg font-mono font-bold ${getScoreColor(data.composite.score)}`}>
            {data.composite.score}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">综合评级</span>
          <span className={`text-xs font-medium ${getLevelColor(data.composite.level)}`}>
            {data.composite.level}
          </span>
        </div>
      </div>

      {/* 详情区域 */}
      <div className="flex-1 overflow-y-auto p-2">
        {viewMode === "market" && (
          <div>
            <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">大盘情绪指标</div>
            {data.market.details.map((detail, i) => (
              <SentimentRow key={i} detail={detail} />
            ))}
          </div>
        )}

        {viewMode === "sector" && (
          <div>
            <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">板块热度指标</div>
            {data.sector.details.map((detail, i) => (
              <SentimentRow key={i} detail={detail} />
            ))}
          </div>
        )}

        {viewMode === "stock" && (
          <div>
            <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">个股情绪指标</div>
            {data.stock.details.map((detail, i) => (
              <SentimentRow key={i} detail={detail} />
            ))}
            {data.stock.tags.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">情绪标签</div>
                <div className="flex flex-wrap gap-1">
                  {data.stock.tags.map((tag, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部概览 */}
      <div className="p-2 border-t border-gray-800 bg-[#0f1419]">
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => setViewMode("market")}
            className={`p-1.5 rounded text-center transition-colors ${
              viewMode === "market" ? "bg-blue-500/20 border border-blue-500/50" : "bg-[#111827] hover:bg-[#1f2937]"
            }`}
          >
            <div className="text-[10px] text-gray-500">大盘</div>
            <div className={`text-xs font-mono font-bold ${getScoreColor(data.market.score)}`}>
              {data.market.score}
            </div>
          </button>
          <button
            onClick={() => setViewMode("sector")}
            className={`p-1.5 rounded text-center transition-colors ${
              viewMode === "sector" ? "bg-blue-500/20 border border-blue-500/50" : "bg-[#111827] hover:bg-[#1f2937]"
            }`}
          >
            <div className="text-[10px] text-gray-500">板块</div>
            <div className={`text-xs font-mono font-bold ${getScoreColor(data.sector.score)}`}>
              {data.sector.score}
            </div>
          </button>
          <button
            onClick={() => setViewMode("stock")}
            className={`p-1.5 rounded text-center transition-colors ${
              viewMode === "stock" ? "bg-blue-500/20 border border-blue-500/50" : "bg-[#111827] hover:bg-[#1f2937]"
            }`}
          >
            <div className="text-[10px] text-gray-500">个股</div>
            <div className={`text-xs font-mono font-bold ${getScoreColor(data.stock.score)}`}>
              {data.stock.score}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
