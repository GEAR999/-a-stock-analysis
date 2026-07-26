// 告警历史记录（内存存储，生产环境应使用数据库）
export interface AlertRecord {
  id: string;
  timestamp: number;
  type: 'error' | 'warning' | 'info';
  source: string;
  message: string;
  resolved: boolean;
  resolvedAt?: number;
}

// 全局告警存储（简单内存实现）
let alertHistory: AlertRecord[] = [];
const MAX_ALERTS = 100;

// 添加告警
export function addAlert(type: AlertRecord['type'], source: string, message: string): AlertRecord {
  const alert: AlertRecord = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    source,
    message,
    resolved: false,
  };
  
  alertHistory.unshift(alert);
  
  // 限制历史记录数量
  if (alertHistory.length > MAX_ALERTS) {
    alertHistory = alertHistory.slice(0, MAX_ALERTS);
  }
  
  return alert;
}

// 获取告警历史
export function getAlertHistory(limit = 50): AlertRecord[] {
  return alertHistory.slice(0, limit);
}

// 标记告警已解决
export function resolveAlert(id: string): AlertRecord | undefined {
  const alert = alertHistory.find(a => a.id === id);
  if (alert) {
    alert.resolved = true;
    alert.resolvedAt = Date.now();
  }
  return alert;
}

// 获取未解决告警数量
export function getUnresolvedAlertCount(): number {
  return alertHistory.filter(a => !a.resolved).length;
}
