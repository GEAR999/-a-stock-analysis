/**
 * 监控系统类型定义
 * 第31轮第4批需求
 */

// ============ 数据源类型 ============

export type DataSourceName = 'mootdx' | 'tushare' | 'eastmoney';
export type SourceStatus = 'ok' | 'degraded' | 'down';
export type AlertLevel = 'info' | 'warn' | 'error';
export type EventType = 'fallback' | 'recovery' | 'alert' | 'probe';

// ============ 探针结果 ============

export interface ProbeResult {
  source: DataSourceName;
  status: SourceStatus;
  latency: number;          // 响应时间(ms)
  lastCheck: string;        // ISO时间
  lastError: string | null;
  details?: Record<string, any>;
}

// ============ 校验结果 ============

export interface ValidationResult {
  valid: boolean;
  level: 'ok' | 'warning' | 'error';
  message: string;
  details?: any;
}

// ============ 告警 ============

export interface AlertEvent {
  id: string;
  level: AlertLevel;
  title: string;
  content: string;
  source?: DataSourceName;
  timestamp: string;
  sent: boolean;           // 是否已发送飞书通知
}

// ============ 健康事件 ============

export interface HealthEvent {
  id?: number;
  event_type: EventType;
  level: AlertLevel;
  source_name?: DataSourceName;
  description: string;
  created_at?: string;
}

// ============ 健康快照 ============

export interface HealthSnapshot {
  id?: number;
  source_name: DataSourceName;
  status: SourceStatus;
  latency_ms: number | null;
  error_message: string | null;
  checked_at?: string;
}

// ============ 汇总接口 ============

export interface SourceHealthSummary {
  status: SourceStatus;
  latency: number;
  lastCheck: string;
  lastError: string | null;
}

export interface HealthSummary {
  mootdx: SourceHealthSummary;
  tushare: SourceHealthSummary;
  eastmoney: SourceHealthSummary;
  overall: SourceStatus;
  timestamp: string;
  stats: {
    last1h_requests: number;
    last1h_success_rate: number;
    last1h_avg_latency: number;
    last1h_fallback_count: number;
  };
}

// ============ 请求统计 ============

export interface RequestStats {
  total: number;
  success: number;
  failed: number;
  totalLatency: number;
  fallbackCount: number;
  lastReset: number;
}

// ============ 降级记录 ============

export interface FallbackRecord {
  timestamp: string;
  reason: string;
  fromSource: DataSourceName;
  toSource: DataSourceName | 'cache';
  recovered?: boolean;
}

// ============ 前端组件Props ============

export interface MonitorPageProps {
  initialData: HealthSummary;
}

export interface SourceCardProps {
  name: DataSourceName;
  displayName: string;
  status: SourceStatus;
  latency: number;
  lastCheck: string;
  lastError: string | null;
}

export interface EventTimelineProps {
  events: HealthEvent[];
}

export interface HealthTrendChartProps {
  snapshots: HealthSnapshot[];
}
