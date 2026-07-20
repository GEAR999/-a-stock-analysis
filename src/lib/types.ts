// Stock data types
export interface StockInfo {
  code: string;
  name: string;
  market: 'sh' | 'sz' | 'bj';
  type: 'stock' | 'etf' | 'index';
}

export interface StockQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  preClose: number;
  volume: number;
  amount: number;
  timestamp: number;
}

export interface KLineData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
}

export type KLinePeriod = 'daily' | 'weekly' | 'monthly' | '60min' | '30min' | '15min' | '5min';

// Analysis types
export interface AnalysisSettings {
  chanlun: boolean;
  wave: boolean;
  technical: boolean;
  macd: boolean;
  kdj: boolean;
  rsi: boolean;
  boll: boolean;
  ma: boolean;
  waveSensitivity: 'high' | 'medium' | 'low';
  maPeriods: number[];
}

export interface ChanlunResult {
  strokes: Array<{ start: number; end: number; direction: 'up' | 'down' }>;
  segments: Array<{ start: number; end: number; direction: 'up' | 'down' }>;
  centers: Array<{ start: number; end: number; high: number; low: number }>;
  buySignals: Array<{ index: number; type: 1 | 2 | 3; price: number }>;
  sellSignals: Array<{ index: number; type: 1 | 2 | 3; price: number }>;
}

export interface WaveResult {
  waves: Array<{ start: number; end: number; label: string; type: 'impulse' | 'corrective' }>;
}

export interface TechnicalIndicators {
  macd: Array<{ dif: number; dea: number; histogram: number }>;
  kdj: Array<{ k: number; d: number; j: number; isWarmup?: boolean }>;
  rsi: Array<{ rsi: number }>;
  boll: Array<{ upper: number; middle: number; lower: number }>;
  ma: Record<number, number[]>;
}

// Sentiment types
export type SentimentScope = 'stock' | 'sector' | 'market';

export interface StockSentiment {
  // Individual stock sentiment
  code: string;
  name: string;
  price: number;
  changePercent: number;
  // Technical strength score (0-100)
  technicalScore: number;
  // Volume analysis
  volumeRatio: number;       // today vs 5-day avg
  volumeTrend: '放量' | '缩量' | '平量';
  // Momentum
  momentumScore: number;     // -100 to 100
  // Support/Resistance
  supportLevel: number;
  resistanceLevel: number;
  // Overall stock heat
  heatScore: number;         // 0-100
  timestamp: number;
}

export interface SectorSentiment {
  name: string;
  flow: number;              // net flow in 亿
  changePercent: number;
  leaderStock: string;
  heatScore: number;
}

export interface MarketSentiment {
  upCount: number;
  downCount: number;
  flatCount: number;
  limitUpCount: number;
  limitDownCount: number;
  totalVolume: number;
  avgVolume5d: number;
  volumeRatio: number;
  heatScore: number;
  sectorFlows: Array<{ name: string; flow: number }>;
  timestamp: number;
}

// AI Assistant types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  mode: 'analysis' | 'debug';
}

// Watchlist types
export interface WatchlistItem {
  code: string;
  name: string;
  market: 'sh' | 'sz' | 'bj';
  order: number;
}
