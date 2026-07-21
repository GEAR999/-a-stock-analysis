/**
 * 告警系统模块
 * 第31轮第4批需求
 * 
 * 三级告警：INFO（控制台）、WARN（页面黄条）、ERROR（飞书通知）
 * 告警去重：同类型5分钟内只发一次飞书
 */

import { AlertLevel, AlertEvent, DataSourceName } from './types';

// ============ 配置 ============

const FEISHU_WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL || '';
const ALERT_DEDUP_TTL = parseInt(process.env.ALERT_DEDUP_TTL || '300', 10); // 5分钟

// ============ 告警去重 ============

const alertDedup = new Map<string, number>(); // key -> lastSentTimestamp

function getDedupKey(level: AlertLevel, title: string, source?: DataSourceName): string {
  return `${level}:${source || 'system'}:${title}`;
}

function shouldSend(key: string): boolean {
  const last = alertDedup.get(key);
  if (!last) return true;
  return Date.now() - last > ALERT_DEDUP_TTL * 1000;
}

function markSent(key: string): void {
  alertDedup.set(key, Date.now());
  // 清理过期
  if (alertDedup.size > 200) {
    const now = Date.now();
    for (const [k, v] of alertDedup) {
      if (now - v > 600000) alertDedup.delete(k);
    }
  }
}

// ============ 告警历史（内存） ============

const alertHistory: AlertEvent[] = [];
const MAX_HISTORY = 500;

function addAlert(event: AlertEvent): void {
  alertHistory.unshift(event);
  if (alertHistory.length > MAX_HISTORY) {
    alertHistory.length = MAX_HISTORY;
  }
}

export function getAlertHistory(limit: number = 50): AlertEvent[] {
  return alertHistory.slice(0, limit);
}

// ============ 飞书通知 ============

async function sendFeishuAlert(level: AlertLevel, title: string, content: string): Promise<boolean> {
  if (!FEISHU_WEBHOOK_URL) {
    console.warn('[ALERT] FEISHU_WEBHOOK_URL not configured, skipping feishu notification');
    return false;
  }

  try {
    const levelEmoji: Record<AlertLevel, string> = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '🚨',
    };

    const levelColor: Record<AlertLevel, string> = {
      info: 'blue',
      warn: 'orange',
      error: 'red',
    };

    const card = {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: `${levelEmoji[level]} A股智析系统告警 - ${title}`,
          },
          template: levelColor[level],
        },
        elements: [
          {
            tag: 'markdown',
            content: content,
          },
          {
            tag: 'note',
            elements: [
              {
                tag: 'plain_text',
                content: `告警时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
              },
            ],
          },
        ],
      },
    };

    const res = await fetch(FEISHU_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });

    if (!res.ok) {
      console.error(`[ALERT] Feishu webhook failed: ${res.status}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[ALERT] Feishu webhook error:', err);
    return false;
  }
}

// ============ 告警触发 ============

export async function triggerAlert(
  level: AlertLevel,
  title: string,
  content: string,
  source?: DataSourceName
): Promise<AlertEvent> {
  const dedupKey = getDedupKey(level, title, source);
  const shouldSendNotif = shouldSend(dedupKey);

  const event: AlertEvent = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    level,
    title,
    content,
    source,
    timestamp: new Date().toISOString(),
    sent: false,
  };

  // 控制台日志（所有级别）
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(`[ALERT:${level.toUpperCase()}] ${title} | ${source || 'system'} | ${content}`);

  // 飞书通知（仅error级别且未去重）
  if (level === 'error' && shouldSendNotif && FEISHU_WEBHOOK_URL) {
    const sent = await sendFeishuAlert(level, title, content);
    event.sent = sent;
    if (sent) markSent(dedupKey);
  }

  // 记录历史
  addAlert(event);

  return event;
}

// ============ 便捷方法 ============

export async function alertSourceDown(source: DataSourceName, error: string): Promise<AlertEvent> {
  return triggerAlert(
    'error',
    `${source} 数据源不可用`,
    `**数据源**: ${source}\n**错误**: ${error}\n**影响**: 系统已自动切换备用数据源`,
    source
  );
}

export async function alertAllSourcesDown(): Promise<AlertEvent> {
  return triggerAlert(
    'error',
    '所有数据源不可用！',
    `**严重告警**\n\n所有数据源均不可用：\n- mootdx: ❌\n- Tushare: ❌\n- 东方财富: ❌\n\n**影响**: 无法获取任何行情数据，系统正在使用缓存数据\n\n请尽快检查各数据源状态！`
  );
}

export async function alertSourceRecovered(source: DataSourceName): Promise<AlertEvent> {
  return triggerAlert(
    'info',
    `${source} 数据源已恢复`,
    `**数据源**: ${source}\n**状态**: ✅ 已恢复正常\n系统已自动切回主数据源`,
    source
  );
}

export async function alertFallback(source: DataSourceName, reason: string): Promise<AlertEvent> {
  return triggerAlert(
    'warn',
    `${source} 降级`,
    `**数据源**: ${source}\n**原因**: ${reason}\n**处理**: 已自动切换备用数据源`,
    source
  );
}
