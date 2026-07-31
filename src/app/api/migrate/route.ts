import { NextRequest, NextResponse } from "next/server";
import { execRaw, queryRaw } from "@/lib/db";

// Migration SQL - each statement executed individually
const MIGRATION_STATEMENTS = [
  // 1. 用户表
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100),
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // 2. 交易账户表
  `CREATE TABLE IF NOT EXISTS accounts (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`,

  // 3. 持仓表
  `CREATE TABLE IF NOT EXISTS positions (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_positions_account_id ON positions(account_id)`,

  // 4. 交易记录表
  `CREATE TABLE IF NOT EXISTS transactions (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_traded_at ON transactions(traded_at DESC)`,

  // 5. 自定义策略表
  `CREATE TABLE IF NOT EXISTS custom_strategies (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_custom_strategies_user_id ON custom_strategies(user_id)`,

  // 6. 策略权重表
  `CREATE TABLE IF NOT EXISTS strategy_weights (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_strategy_weights_account_id ON strategy_weights(account_id)`,

  // 7. 策略模板表
  `CREATE TABLE IF NOT EXISTS strategy_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_strategy_templates_user_id ON strategy_templates(user_id)`,

  // 8. 自选股表
  `CREATE TABLE IF NOT EXISTS watchlist (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_unique ON watchlist(user_id, stock_code, group_name)`,
  `CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id)`,

  // 9. 分析缓存表
  `CREATE TABLE IF NOT EXISTS analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_code VARCHAR(10) NOT NULL,
    analysis_type VARCHAR(30) NOT NULL,
    result JSONB NOT NULL DEFAULT '{}',
    score DECIMAL(5,2),
    signal VARCHAR(20),
    computed_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_analysis_cache_lookup ON analysis_cache(stock_code, analysis_type, computed_at DESC)`,

  // 10. 学习进度表
  `CREATE TABLE IF NOT EXISTS learning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    lesson_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'not_started',
    progress DECIMAL(5,4) DEFAULT 0,
    last_accessed_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    notes TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_unique ON learning_progress(user_id, module, lesson_id)`,
  `CREATE INDEX IF NOT EXISTS idx_learning_user_id ON learning_progress(user_id)`,

  // 11. 实时市场参数表（李富贵推送的大盘/自选股快照）
  `CREATE TABLE IF NOT EXISTS realtime_market_params (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    sh_price DECIMAL(10,2),
    sh_change_pct DECIMAL(5,2),
    sz_price DECIMAL(10,2),
    sz_change_pct DECIMAL(5,2),
    cyb_price DECIMAL(10,2),
    cyb_change_pct DECIMAL(5,2),
    advance_count INTEGER,
    decline_count INTEGER,
    limit_up INTEGER,
    limit_down INTEGER,
    total_volume DECIMAL(12,2),
    watchlist_data JSONB DEFAULT '{"etf":[],"stock":[]}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_realtime_market_params_timestamp ON realtime_market_params(timestamp DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_realtime_market_params_created_at ON realtime_market_params(created_at DESC)`,

  // 12. 市场参数配置表（自选股/ETF 配置）
  `CREATE TABLE IF NOT EXISTS market_params_config (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
    watchlist_etf JSONB DEFAULT '[]'::jsonb,
    watchlist_stock JSONB DEFAULT '[]'::jsonb,
    push_token VARCHAR(255) NOT NULL DEFAULT 'env-managed',
    push_times TEXT[] DEFAULT ARRAY['09:35', '10:00', '10:30', '13:05', '14:00', '14:45'],
    update_interval INTEGER DEFAULT 60,
    data_retention_days INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_market_params_config_user_id ON market_params_config(user_id)`,

  // 13. 大盘情绪快照表（多因子分析 - 情绪层）
  `CREATE TABLE IF NOT EXISTS sentiment_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL,
    total_volume DECIMAL(12,2),
    volume_change_pct DECIMAL(6,2),
    turnover_rate DECIMAL(6,2),
    turnover_change_pct DECIMAL(6,2),
    limit_up_count INTEGER,
    limit_up_change_pct DECIMAL(6,2),
    limit_down_count INTEGER,
    limit_down_change_pct DECIMAL(6,2),
    margin_balance DECIMAL(14,2),
    margin_change_pct DECIMAL(6,2),
    sentiment_score DECIMAL(4,2),
    heat_level VARCHAR(20),
    factor_scores JSONB,
    raw_data JSONB,
    status VARCHAR(20) DEFAULT 'available',
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sentiment_snapshot_timestamp ON sentiment_snapshot(timestamp DESC)`,

  // 14. 策略情绪模式配置表（多因子分析 - 策略关联）
  `CREATE TABLE IF NOT EXISTS strategy_sentiment_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id VARCHAR(100) NOT NULL,
    sentiment_mode VARCHAR(20) NOT NULL CHECK (sentiment_mode IN ('contrarian', 'trend_follow', 'neutral')),
    custom_weights JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_sentiment_config_strategy_id ON strategy_sentiment_config(strategy_id)`,

  // 15. 仓位计算日志表（多因子分析 - 决策记录）
  `CREATE TABLE IF NOT EXISTS position_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL,
    strategy_id VARCHAR(100),
    factor_scores JSONB NOT NULL,
    total_score DECIMAL(4,2) NOT NULL,
    base_position DECIMAL(5,2) NOT NULL,
    sentiment_score DECIMAL(4,2) NOT NULL,
    correction_factor DECIMAL(4,2) NOT NULL,
    final_position DECIMAL(5,2) NOT NULL,
    position_label VARCHAR(20),
    timestamp TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_position_log_code ON position_log(code, timestamp DESC)`,

  // 16. 股票列表表（Tushare stock_basic 全量同步，用于本地化搜索）
  `CREATE TABLE IF NOT EXISTS stock_list (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    market VARCHAR(5) NOT NULL,
    industry VARCHAR(100),
    list_date VARCHAR(10),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_stock_list_name ON stock_list(name)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_list_industry ON stock_list(industry)`,

  // 17. K 线缓存表（Tushare 数据落地缓存，减少重复请求）
  `CREATE TABLE IF NOT EXISTS kline_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_code VARCHAR(10) NOT NULL,
    period VARCHAR(20) NOT NULL,
    is_realtime BOOLEAN DEFAULT false,
    data JSONB NOT NULL,
    source VARCHAR(20),
    hit_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(stock_code, period, is_realtime)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kline_cache_lookup ON kline_cache(stock_code, period, is_realtime)`,

  // 18. 海外股价表（李富贵推送）
  `CREATE TABLE IF NOT EXISTS overseas_prices (
    id SERIAL PRIMARY KEY,
    trade_date DATE NOT NULL,
    nvda DECIMAL(10,2),
    aapl DECIMAL(10,2),
    tsla DECIMAL(10,2),
    amd DECIMAL(10,2),
    avgo DECIMAL(10,2),
    tsm DECIMAL(10,2),
    qcom DECIMAL(10,2),
    googl DECIMAL(10,2),
    msft DECIMAL(10,2),
    intc DECIMAL(10,2),
    nikkei DECIMAL(10,2),
    tel DECIMAL(10,2),
    samsung DECIMAL(10,2),
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(trade_date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_overseas_prices_trade_date ON overseas_prices(trade_date DESC)`,

  // 19. 中国宏观数据表（李富贵推送）
  `CREATE TABLE IF NOT EXISTS macro_china (
    id SERIAL PRIMARY KEY,
    period VARCHAR(10) NOT NULL,
    pmi DECIMAL(5,2),
    cpi DECIMAL(5,2),
    ppi DECIMAL(5,2),
    social_financing DECIMAL(10,4),
    m2_growth DECIMAL(5,2),
    gdp_yoy DECIMAL(5,2),
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_macro_china_period ON macro_china(period DESC)`,

  // 20. 美国宏观数据表（李富贵推送）
  `CREATE TABLE IF NOT EXISTS macro_us (
    id SERIAL PRIMARY KEY,
    period VARCHAR(10) NOT NULL,
    cpi DECIMAL(5,2),
    core_pce DECIMAL(5,2),
    nonfarm_payroll INTEGER,
    unemployment_rate DECIMAL(5,2),
    fed_rate DECIMAL(5,2),
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_macro_us_period ON macro_us(period DESC)`,

  // 21. 央行利率表（李富贵推送）
  `CREATE TABLE IF NOT EXISTS central_bank_rates (
    id SERIAL PRIMARY KEY,
    bank VARCHAR(10) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(bank)
  )`,

  // 22. sentiment_snapshot 表新增字段（李富贵统一推送结构）
  `ALTER TABLE sentiment_snapshot ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available'`,
  `ALTER TABLE sentiment_snapshot ADD COLUMN IF NOT EXISTS message TEXT`,
  `ALTER TABLE sentiment_snapshot ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'sentiment'`,
  `ALTER TABLE sentiment_snapshot ADD COLUMN IF NOT EXISTS sentiment JSONB`,
  `ALTER TABLE sentiment_snapshot ADD COLUMN IF NOT EXISTS overseas JSONB`,
  `ALTER TABLE sentiment_snapshot ADD COLUMN IF NOT EXISTS macro_china JSONB`,
  `ALTER TABLE sentiment_snapshot ADD COLUMN IF NOT EXISTS macro_us JSONB`,
  `ALTER TABLE sentiment_snapshot ADD COLUMN IF NOT EXISTS rate JSONB`,
];

const EXPECTED_TABLES = [
  "users",
  "accounts",
  "positions",
  "transactions",
  "custom_strategies",
  "strategy_weights",
  "strategy_templates",
  "watchlist",
  "analysis_cache",
  "learning_progress",
  "realtime_market_params",
  "market_params_config",
  "sentiment_snapshot",
  "strategy_sentiment_config",
  "position_log",
  "stock_list",
  "kline_cache",
  "overseas_prices",
  "macro_china",
  "macro_us",
  "central_bank_rates",
];

// POST: Execute migration
export async function POST() {
  const results: { statement: string; success: boolean; error?: string }[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const stmt of MIGRATION_STATEMENTS) {
    try {
      await execRaw(stmt);
      results.push({ statement: stmt.substring(0, 50) + "...", success: true });
      successCount++;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({ statement: stmt.substring(0, 50) + "...", success: false, error: errorMsg });
      failCount++;
    }
  }

  return NextResponse.json({
    success: failCount === 0,
    total: MIGRATION_STATEMENTS.length,
    successCount,
    failCount,
    results,
  });
}

// GET: Check migration status
export async function GET() {
  try {
    const { rows } = await queryRaw<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );

    const existingTables = rows.map((r) => r.tablename);
    const missingTables = EXPECTED_TABLES.filter((t) => !existingTables.includes(t));

    return NextResponse.json({
      success: true,
      totalTables: EXPECTED_TABLES.length,
      existingTables: existingTables.filter((t) => EXPECTED_TABLES.includes(t)),
      missingTables,
      isComplete: missingTables.length === 0,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "检查迁移状态失败: " + errorMsg },
      { status: 500 }
    );
  }
}
