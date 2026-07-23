// 量化实时账户类型定义

export interface QuantLiveAccount {
  id: string;
  name: string;
  stock_code: string;
  stock_name?: string;
  initial_capital: number;
  current_cash: number;
  created_at: string;
  last_run_at?: string;
  status: 'active' | 'paused';
  user_id?: string;
}

export interface QuantLiveTrade {
  id: string;
  account_id: string;
  stock_code: string;
  stock_name?: string;
  direction: 'buy' | 'sell';
  price: number;
  quantity: number;
  amount: number;
  signal_type?: string;
  strategy_snapshot_id?: string;
  strategy?: string;
  reason?: string;
  created_at: string;
}

export interface QuantLivePosition {
  id: string;
  account_id: string;
  stock_code: string;
  stock_name?: string;
  quantity: number;
  cost_price: number;
  current_price?: number;
  created_at: string;
  updated_at: string;
}

export interface QuantLiveStrategySnapshot {
  id: string;
  account_id: string;
  strategy_id: string;
  strategy_name?: string;
  strategy_config: any; // FullStrategyConfig
  effective_from: string;
  effective_to?: string;
  created_at: string;
}

export interface QuantLiveDailySnapshot {
  id: string;
  account_id: string;
  date: string;
  total_value: number;
  cash: number;
  position_value: number;
  daily_return?: number;
  created_at: string;
}

// WebSocket 消息类型
export interface WSMessage {
  type: 'check' | 'trade' | 'error' | 'status';
  accountId?: string;
  timestamp?: string;
  data?: any;
  message?: string;
}

// 监控状态
export type MonitorStatus = 'idle' | 'connecting' | 'connected' | 'paused' | 'error';
