/**
 * 监控系统模块导出
 * 第31轮第4批需求
 */

// 类型
export type {
  DataSourceName,
  SourceStatus,
  AlertLevel,
  EventType,
  ProbeResult,
  ValidationResult,
  AlertEvent,
  HealthEvent,
  HealthSnapshot,
  SourceHealthSummary,
  HealthSummary,
  RequestStats,
  FallbackRecord,
  MonitorPageProps,
  SourceCardProps,
  EventTimelineProps,
  HealthTrendChartProps,
} from './types';

// 探针
export { runProbe, runAllProbes, getCachedProbes, clearProbeCache, probeToSnapshot } from './probes';

// 数据校验
export {
  checkDataFreshness,
  checkPriceContinuity,
  checkVolumeValidity,
  checkCrossSourceConsistency,
  runQualityChecks,
} from './data-validator';

// 告警
export {
  triggerAlert,
  alertSourceDown,
  alertAllSourcesDown,
  alertSourceRecovered,
  alertFallback,
  getAlertHistory,
} from './alert';

// 自动修复
export {
  autoFallback,
  checkRecovery,
  getBestAvailableSource,
  getAllSourceStates,
  setSourceState,
  resetAllStates,
  recordRequest,
  getHourlyStats,
  getFallbackHistory,
} from './auto-fix';
