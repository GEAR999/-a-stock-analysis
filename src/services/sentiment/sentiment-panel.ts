// 综合评估模块 - 整合三个维度的情绪分析

import type { 
  MarketSentimentResult, 
  SectorSentimentResult, 
  StockSentimentResult, 
  ComprehensiveSentiment,
  SentimentDetail
} from './types';
import { fetchMarketSentiment } from './market-sentiment';
import { fetchSectorSentiment } from './sector-sentiment';
import { fetchStockSentiment } from './stock-sentiment';

// 计算综合评分
function calculateOverallScore(
  market: MarketSentimentResult,
  sector: SectorSentimentResult,
  stock: StockSentimentResult
): number {
  // 权重分配：大盘40%，板块30%，个股30%
  return Math.round(market.score * 0.4 + sector.score * 0.3 + stock.score * 0.3);
}

// 生成操作建议
function generateSuggestion(
  overallScore: number,
  market: MarketSentimentResult,
  sector: SectorSentimentResult,
  stock: StockSentimentResult
): string {
  const suggestions: string[] = [];
  
  // 根据综合得分给出基础建议
  if (overallScore >= 80) {
    suggestions.push('市场情绪极度乐观，可积极参与但注意追高风险');
  } else if (overallScore >= 60) {
    suggestions.push('市场情绪偏暖，可适当参与');
  } else if (overallScore >= 40) {
    suggestions.push('市场情绪中性，建议观望或轻仓');
  } else if (overallScore >= 20) {
    suggestions.push('市场情绪偏冷，建议谨慎操作');
  } else {
    suggestions.push('市场极度恐慌，建议空仓观望');
  }
  
  // 根据各维度补充建议
  if (market.score < 30 && stock.score > 60) {
    suggestions.push('大盘弱势但个股强势，注意控制仓位');
  }
  
  if (sector.score > 70) {
    suggestions.push(`所属板块热度高(${sector.level})，可关注板块机会`);
  }
  
  if (stock.score > 70 && market.score < 50) {
    suggestions.push('个股强于大盘，但需注意系统性风险');
  }
  
  if (stock.score < 30) {
    suggestions.push('个股情绪低迷，建议回避或减仓');
  }
  
  return suggestions.join('；');
}

// 评估风险等级
function evaluateRiskLevel(
  overallScore: number,
  market: MarketSentimentResult,
  stock: StockSentimentResult
): '低' | '中' | '高' | '极高' {
  // 综合得分越低，风险越高
  // 大盘情绪越差，风险越高
  // 个股与大盘背离越大，风险越高
  
  const marketRisk = market.score < 30 ? 2 : market.score < 50 ? 1 : 0;
  const stockRisk = stock.score < 30 ? 2 : stock.score < 50 ? 1 : 0;
  const overallRisk = overallScore < 30 ? 2 : overallScore < 50 ? 1 : 0;
  
  const totalRisk = marketRisk + stockRisk + overallRisk;
  
  if (totalRisk >= 5) return '极高';
  if (totalRisk >= 3) return '高';
  if (totalRisk >= 1) return '中';
  return '低';
}

// 主函数：生成综合评估（支持null值，null表示"暂无数据"）
export function calculateComprehensiveSentiment(
  market: MarketSentimentResult | null,
  sector: SectorSentimentResult | null,
  stock: StockSentimentResult | null
): ComprehensiveSentiment {
  // 如果所有维度都无数据，返回"暂无数据"
  if (!market && !sector && !stock) {
    const noDataDetail: SentimentDetail = {
      name: '数据状态',
      score: 0,
      weight: 0,
      value: '暂无数据',
      description: '缺少真实行情数据源，无法计算情绪指标',
      calculation: '需要接入东方财富/mootdx等实时行情API',
      impact: '无法提供情绪参考',
    };
    return {
      market: { score: 0, level: '中性', details: [noDataDetail] },
      sector: { score: 0, level: '冷门', details: [noDataDetail] },
      stock: { score: 0, tags: ['暂无数据'], details: [noDataDetail] },
      overallScore: 0,
      suggestion: '暂无足够数据生成综合评估',
      riskLevel: '中',
      composite: {
        score: 0,
        level: '暂无数据',
        description: '缺少真实行情数据，无法进行综合情绪评估',
      },
    };
  }

  // 有数据时正常计算（null维度按0分处理）
  const marketScore = market?.score ?? 0;
  const sectorScore = sector?.score ?? 0;
  const stockScore = stock?.score ?? 0;
  const overallScore = Math.round(marketScore * 0.4 + sectorScore * 0.3 + stockScore * 0.3);

  // 生成综合评级
  let compositeLevel: string;
  let compositeDescription: string;
  if (overallScore >= 80) {
    compositeLevel = '极度乐观';
    compositeDescription = '市场情绪极度乐观，大盘、板块、个股全面看涨';
  } else if (overallScore >= 60) {
    compositeLevel = '偏暖';
    compositeDescription = '市场情绪偏暖，多数维度看涨';
  } else if (overallScore >= 40) {
    compositeLevel = '中性';
    compositeDescription = '市场情绪中性，方向不明';
  } else if (overallScore >= 20) {
    compositeLevel = '偏冷';
    compositeDescription = '市场情绪偏冷，多数维度看跌';
  } else {
    compositeLevel = '极度悲观';
    compositeDescription = '市场情绪极度悲观，大盘、板块、个股全面看跌';
  }

  const noDataDetail: SentimentDetail = {
    name: '数据状态',
    score: 0,
    weight: 0,
    value: '暂无数据',
    description: '该维度缺少实时数据',
    calculation: '-',
    impact: '-',
  };
  const defaultMarket: MarketSentimentResult = { score: 0, level: '中性', details: [noDataDetail] };
  const defaultSector: SectorSentimentResult = { score: 0, level: '冷门', details: [noDataDetail] };
  const defaultStock: StockSentimentResult = { score: 0, tags: ['暂无数据'], details: [noDataDetail] };

  return {
    market: market || defaultMarket,
    sector: sector || defaultSector,
    stock: stock || defaultStock,
    overallScore,
    suggestion: '暂无足够数据生成操作建议',
    riskLevel: '中',
    composite: {
      score: overallScore,
      level: compositeLevel,
      description: compositeDescription,
    },
  };
}

// 获取综合评估（无真实数据时返回"暂无数据"）
export function fetchComprehensiveSentiment(
  sectorName?: string,
  stockCode?: string
): ComprehensiveSentiment {
  const market = fetchMarketSentiment();
  const sector = fetchSectorSentiment(sectorName);
  const stock = fetchStockSentiment(stockCode);

  return calculateComprehensiveSentiment(market, sector, stock);
}
