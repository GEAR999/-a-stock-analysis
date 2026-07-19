// 板块情绪算法 - 5个指标加权评分

import type { SectorData, SectorSentimentResult, SentimentDetail, SectorLevel } from './types';

// 板块涨跌比（25%）
function calcSectorUpDownRatio(data: SectorData): SentimentDetail {
  const ratio = data.totalStocks > 0 ? data.upCount / data.totalStocks : 0;
  const score = Math.min(100, Math.max(0, ratio * 100));
  const value = `${data.upCount}/${data.totalStocks}家上涨 (${(ratio * 100).toFixed(1)}%)`;
  
  return {
    name: '板块涨跌比',
    score: Math.round(score),
    weight: 25,
    value,
    description: '板块内上涨股票占比，反映板块整体强弱',
    calculation: `上涨${data.upCount}家 / 总计${data.totalStocks}家 = ${(ratio * 100).toFixed(1)}%`,
    impact: score > 70 ? '板块强势，多数个股上涨' : score > 40 ? '板块分化，涨跌参半' : '板块弱势，多数个股下跌',
  };
}

// 主力资金流向（25%）
function calcSectorNetInflow(data: SectorData): SentimentDetail {
  const ratio = data.marketCap > 0 ? (data.netInflow / data.marketCap) * 10000 : 0;
  let score: number;
  
  if (ratio >= 50) {
    score = 100;
  } else if (ratio >= 20) {
    score = 70 + (ratio - 20) * 1;
  } else if (ratio >= 0) {
    score = 50 + ratio * 1;
  } else if (ratio >= -30) {
    score = 30 + (ratio + 30) * 0.67;
  } else {
    score = Math.max(0, 30 + (ratio + 30) * 0.67);
  }
  
  score = Math.min(100, Math.max(0, score));
  const value = `净流入${(data.netInflow / 100000000).toFixed(2)}亿 (占比${ratio.toFixed(2)}‱)`;
  
  return {
    name: '主力资金流向',
    score: Math.round(score),
    weight: 25,
    value,
    description: '板块主力资金净流入额占流通市值的比例，反映主力对板块的态度',
    calculation: `净流入${(data.netInflow / 100000000).toFixed(2)}亿 / 流通市值${(data.marketCap / 100000000).toFixed(0)}亿 × 10000 = ${ratio.toFixed(2)}‱`,
    impact: score > 70 ? '主力大幅流入，看好板块' : score > 40 ? '主力态度中性' : '主力流出，看淡板块',
  };
}

// 板块换手率（15%）
function calcSectorTurnover(data: SectorData): SentimentDetail {
  const score = Math.min(100, Math.max(0, (data.turnoverRate / 10) * 100));
  const value = `${data.turnoverRate.toFixed(2)}%`;
  
  return {
    name: '板块换手率',
    score: Math.round(score),
    weight: 15,
    value,
    description: '板块整体换手率，反映板块交易活跃度和资金关注度',
    calculation: `换手率${data.turnoverRate.toFixed(2)}% / 10% × 100 = ${score.toFixed(0)}分`,
    impact: score > 70 ? '板块极度活跃，资金追捧' : score > 40 ? '板块活跃度一般' : '板块冷清，资金回避',
  };
}

// 龙头股强度（20%）
function calcTopStockStrength(data: SectorData): SentimentDetail {
  const score = Math.min(100, Math.max(0, data.top3AvgGain * 10));
  const value = `Top3平均涨幅${data.top3AvgGain.toFixed(2)}%`;
  
  return {
    name: '龙头股强度',
    score: Math.round(score),
    weight: 20,
    value,
    description: '板块内涨幅前3名股票的平均涨幅，反映板块龙头的带动效应',
    calculation: `Top3平均涨幅${data.top3AvgGain.toFixed(2)}% × 10 = ${score.toFixed(0)}分`,
    impact: score > 70 ? '龙头强势，带动效应明显' : score > 40 ? '龙头表现一般' : '龙头疲软，缺乏带动',
  };
}

// 板块持续性（15%）
function calcSectorPersistence(data: SectorData): SentimentDetail {
  const score = Math.min(100, Math.max(0, data.consecutiveUpDays * 20));
  const value = `连涨${data.consecutiveUpDays}天`;
  
  return {
    name: '板块持续性',
    score: Math.round(score),
    weight: 15,
    value,
    description: '板块连续上涨天数，反映板块行情的持续性和资金认可度',
    calculation: `连涨${data.consecutiveUpDays}天 × 20 = ${Math.min(100, data.consecutiveUpDays * 20)}分`,
    impact: score > 70 ? '板块持续强势，趋势确立' : score > 40 ? '板块有一定持续性' : '板块行情短暂，缺乏持续',
  };
}

// 计算综合等级
function getLevel(score: number): SectorLevel {
  if (score > 80) return '爆热';
  if (score > 60) return '热门';
  if (score > 40) return '温和';
  return '冷门';
}

// 主函数：计算板块情绪
export function calculateSectorSentiment(data: SectorData): SectorSentimentResult {
  const details: SentimentDetail[] = [
    calcSectorUpDownRatio(data),
    calcSectorNetInflow(data),
    calcSectorTurnover(data),
    calcTopStockStrength(data),
    calcSectorPersistence(data),
  ];
  
  // 加权计算总分
  const totalWeight = details.reduce((sum, d) => sum + d.weight, 0);
  const score = Math.round(
    details.reduce((sum, d) => sum + d.score * (d.weight / totalWeight), 0)
  );
  
  return {
    score,
    level: getLevel(score),
    details,
  };
}

// Mock数据获取
export function fetchSectorSentiment(_sectorName?: string): SectorSentimentResult {
  const mockData: SectorData = {
    upCount: 35,
    totalStocks: 48,
    netInflow: 5200000000, // 52亿
    marketCap: 850000000000, // 8500亿
    turnoverRate: 6.8,
    top3AvgGain: 8.5,
    consecutiveUpDays: 3,
  };
  
  return calculateSectorSentiment(mockData);
}
