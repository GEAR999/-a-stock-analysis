// 情绪分析类型定义

export interface SentimentDetail {
  name: string;
  score: number;
  weight: number;
  value: string;
  description: string;
  calculation: string;
  impact: string;
}

export interface MarketData {
  upCount: number;
  downCount: number;
  limitUpCount: number;
  limitDownCount: number;
  todayVolume: number;
  avgVolume20: number;
  maxBoardDays: number;
  brokenBoardRate: number;
  northNetFlow: number;
  marginChange5d: number;
  newHighCount: number;
  newLowCount: number;
  totalStocks: number;
}

export interface SectorData {
  upCount: number;
  totalStocks: number;
  netInflow: number;
  marketCap: number;
  turnoverRate: number;
  top3AvgGain: number;
  consecutiveUpDays: number;
}

export interface StockData {
  todayVolume: number;
  avgVolume5: number;
  turnoverRate: number;
  turnoverHistory60: number[];
  bigOrderNetInflow: number;
  marketCap: number;
  aboveAvgPriceRatio: number;
  isLimitUp: boolean;
  changePercent: number;
  bidVolume: number;
  floatShares: number;
  hasDragonTiger: boolean;
  dragonTigerType: string;
  marginChange5d: number;
}

export type MarketLevel = '极度恐慌' | '恐慌' | '中性' | '贪婪' | '极度贪婪';
export type SectorLevel = '爆热' | '热门' | '温和' | '冷门';

export interface MarketSentimentResult {
  score: number;
  level: MarketLevel;
  details: SentimentDetail[];
}

export interface SectorSentimentResult {
  score: number;
  level: SectorLevel;
  details: SentimentDetail[];
}

export interface StockSentimentResult {
  score: number;
  tags: string[];
  details: SentimentDetail[];
}

export interface ComprehensiveSentiment {
  market: MarketSentimentResult;
  sector: SectorSentimentResult;
  stock: StockSentimentResult;
  overallScore: number;
  suggestion: string;
  riskLevel: '低' | '中' | '高' | '极高';
}
