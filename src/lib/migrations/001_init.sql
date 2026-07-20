-- A股智能分析系统 - 数据库迁移脚本
-- 适用于 Neon PostgreSQL

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  username VARCHAR(100),
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 交易账户表
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('manual', 'quant')),
  initial_capital DECIMAL(15,2) NOT NULL DEFAULT 1000000.00,
  current_capital DECIMAL(15,2) NOT NULL DEFAULT 1000000.00,
  quant_threshold DECIMAL(5,2) DEFAULT 70.00,
  auto_trade BOOLEAN DEFAULT false,
  max_position_ratio DECIMAL(5,4) DEFAULT 0.25,
  stop_loss_ratio DECIMAL(5,4) DEFAULT 0.05,
  take_profit_ratio DECIMAL(5,4) DEFAULT 0.10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- 3. 持仓表
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  avg_cost DECIMAL(10,4) NOT NULL,
  current_price DECIMAL(10,4),
  market_value DECIMAL(15,2),
  profit_loss DECIMAL(15,2),
  profit_loss_ratio DECIMAL(8,4),
  open_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_positions_account_id ON positions(account_id);

-- 4. 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(50) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
  price DECIMAL(10,4) NOT NULL,
  quantity INTEGER NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  fee DECIMAL(10,2) DEFAULT 0,
  strategy_signals JSONB,
  note TEXT,
  traded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_traded_at ON transactions(traded_at DESC);

-- 5. 自定义策略表
CREATE TABLE IF NOT EXISTS custom_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  theories VARCHAR(50)[],
  buy_conditions JSONB NOT NULL DEFAULT '{}',
  sell_conditions JSONB NOT NULL DEFAULT '{}',
  position_ratio DECIMAL(5,4) DEFAULT 0.25,
  stop_loss DECIMAL(5,4) DEFAULT 0.05,
  take_profit DECIMAL(5,4) DEFAULT 0.10,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_strategies_user_id ON custom_strategies(user_id);

-- 6. 策略权重表
CREATE TABLE IF NOT EXISTS strategy_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  strategy_id VARCHAR(100) NOT NULL,
  strategy_name VARCHAR(100) NOT NULL,
  strategy_type VARCHAR(20) NOT NULL CHECK (strategy_type IN ('builtin', 'custom')),
  weight DECIMAL(5,4) NOT NULL,
  confidence DECIMAL(5,4) DEFAULT 0.70,
  is_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_strategy_weights_account_id ON strategy_weights(account_id);

-- 7. 策略模板表
CREATE TABLE IF NOT EXISTS strategy_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_strategy_templates_user_id ON strategy_templates(user_id);

-- 8. 自选股表
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(50) NOT NULL,
  group_name VARCHAR(50) DEFAULT '默认',
  alert_price_high DECIMAL(10,4),
  alert_price_low DECIMAL(10,4),
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  added_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_unique ON watchlist(user_id, stock_code, group_name);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);

-- 9. 分析缓存表
CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_code VARCHAR(10) NOT NULL,
  analysis_type VARCHAR(30) NOT NULL,
  result JSONB NOT NULL DEFAULT '{}',
  score DECIMAL(5,2),
  signal VARCHAR(20),
  computed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_lookup ON analysis_cache(stock_code, analysis_type, computed_at DESC);

-- 10. 学习进度表
CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  lesson_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'not_started',
  progress DECIMAL(5,4) DEFAULT 0,
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  notes TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_unique ON learning_progress(user_id, module, lesson_id);
CREATE INDEX IF NOT EXISTS idx_learning_user_id ON learning_progress(user_id);
