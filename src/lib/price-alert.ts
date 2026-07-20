// 价格预警系统

export type AlertCondition = 'above' | 'below' | 'change_pct';

export interface PriceAlert {
  id: string;
  code: string;
  name: string;
  condition: AlertCondition;
  value: number; // 价格或涨跌幅百分比
  enabled: boolean;
  triggered: boolean;
  triggerCount: number;
  repeatTrigger: boolean; // 是否重复触发
  createdAt: number;
  lastTriggeredAt?: number;
}

const STORAGE_KEY = 'price-alerts';

// 加载预警规则
export function loadAlerts(): PriceAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 保存预警规则
export function saveAlerts(alerts: PriceAlert[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch (e) {
    console.warn('[PriceAlert] 保存预警规则失败:', e);
  }
}

// 添加预警规则
export function addAlert(alert: Omit<PriceAlert, 'id' | 'triggered' | 'triggerCount' | 'createdAt'>): PriceAlert {
  const alerts = loadAlerts();
  const newAlert: PriceAlert = {
    ...alert,
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    triggered: false,
    triggerCount: 0,
    createdAt: Date.now(),
  };
  alerts.push(newAlert);
  saveAlerts(alerts);
  return newAlert;
}

// 更新预警规则
export function updateAlert(id: string, updates: Partial<PriceAlert>): void {
  const alerts = loadAlerts();
  const index = alerts.findIndex(a => a.id === id);
  if (index !== -1) {
    alerts[index] = { ...alerts[index], ...updates };
    saveAlerts(alerts);
  }
}

// 删除预警规则
export function deleteAlert(id: string): void {
  const alerts = loadAlerts().filter(a => a.id !== id);
  saveAlerts(alerts);
}

// 检查预警是否触发
export function checkAlert(alert: PriceAlert, currentPrice: number, prevClose: number): boolean {
  if (!alert.enabled) return false;
  if (alert.triggered && !alert.repeatTrigger) return false;

  switch (alert.condition) {
    case 'above':
      return currentPrice >= alert.value;
    case 'below':
      return currentPrice <= alert.value;
    case 'change_pct': {
      if (prevClose <= 0) return false;
      const changePct = ((currentPrice - prevClose) / prevClose) * 100;
      return Math.abs(changePct) >= alert.value;
    }
    default:
      return false;
  }
}

// 批量检查所有预警
export function checkAllAlerts(
  alerts: PriceAlert[],
  priceMap: Map<string, { price: number; prevClose: number }>
): PriceAlert[] {
  const triggeredAlerts: PriceAlert[] = [];

  for (const alert of alerts) {
    const priceData = priceMap.get(alert.code);
    if (!priceData) continue;

    if (checkAlert(alert, priceData.price, priceData.prevClose)) {
      triggeredAlerts.push(alert);
      // 更新预警状态
      updateAlert(alert.id, {
        triggered: true,
        triggerCount: alert.triggerCount + 1,
        lastTriggeredAt: Date.now(),
      });
    }
  }

  return triggeredAlerts;
}

// 重置预警触发状态
export function resetAlert(id: string): void {
  updateAlert(id, { triggered: false });
}

// 生成预警触发通知文本
export function getAlertMessage(alert: PriceAlert, currentPrice: number, prevClose: number): string {
  const changePct = prevClose > 0 ? ((currentPrice - prevClose) / prevClose * 100).toFixed(2) : '0';

  switch (alert.condition) {
    case 'above':
      return `${alert.name}(${alert.code}) 突破 ${alert.value}元，当前 ${currentPrice}元`;
    case 'below':
      return `${alert.name}(${alert.code}) 跌破 ${alert.value}元，当前 ${currentPrice}元`;
    case 'change_pct':
      return `${alert.name}(${alert.code}) 涨跌幅超过 ${alert.value}%，当前 ${changePct}%`;
    default:
      return `${alert.name}(${alert.code}) 预警触发`;
  }
}

// 播放提示音
export function playAlertSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    console.warn('[PriceAlert] 播放提示音失败:', e);
  }
}

// 发送浏览器通知
export async function sendBrowserNotification(title: string, body: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  try {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    }
  } catch (e) {
    console.warn('[PriceAlert] 发送浏览器通知失败:', e);
  }
}
