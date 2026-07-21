-- ========================================
-- 健康监控系统数据库表
-- 第31轮第4批需求
-- 在 Neon PostgreSQL 中执行
-- ========================================

-- 健康快照表：记录每次探针检测结果
CREATE TABLE IF NOT EXISTS health_snapshots (
  id SERIAL PRIMARY KEY,
  source_name VARCHAR(50) NOT NULL,    -- mootdx/tushare/eastmoney
  status VARCHAR(20) NOT NULL,         -- ok/degraded/down
  latency_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP DEFAULT NOW()
);

-- 索引：按数据源+时间查询
CREATE INDEX IF NOT EXISTS idx_health_snapshots_source_time 
  ON health_snapshots(source_name, checked_at DESC);

-- 健康事件表：记录降级/恢复/告警事件
CREATE TABLE IF NOT EXISTS health_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,     -- fallback/recovery/alert
  level VARCHAR(20) NOT NULL,          -- info/warn/error
  source_name VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引：按时间查询
CREATE INDEX IF NOT EXISTS idx_health_events_time 
  ON health_events(created_at DESC);

-- 定期清理（可选，保留7天数据）
-- 建议通过 Vercel Cron 或外部任务执行：
-- DELETE FROM health_snapshots WHERE checked_at < NOW() - INTERVAL '7 days';
-- DELETE FROM health_events WHERE created_at < NOW() - INTERVAL '7 days';
