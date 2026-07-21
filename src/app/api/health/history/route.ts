/**
 * 健康历史 API
 * GET /api/health/history?hours=24
 * 
 * 返回最近N小时的健康事件列表
 */

import { NextResponse } from 'next/server';
import { getAlertHistory, getFallbackHistory } from '@/lib/monitor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const cutoff = Date.now() - hours * 3600 * 1000;
    const cutoffISO = new Date(cutoff).toISOString();

    // 获取告警事件
    const alerts = getAlertHistory(200).filter(a => a.timestamp >= cutoffISO);

    // 获取降级事件
    const fallbacks = getFallbackHistory().filter(f => {
      const t = new Date(f.timestamp).getTime();
      return t >= cutoff;
    });

    // 合并并按时间排序
    const events = [
      ...alerts.map(a => ({
        type: 'alert' as const,
        level: a.level,
        source: a.source,
        description: `${a.title}: ${a.content}`,
        timestamp: a.timestamp,
      })),
      ...fallbacks.map(f => ({
        type: 'fallback' as const,
        level: 'warn' as const,
        source: f.fromSource,
        description: `${f.fromSource} → ${f.toSource}: ${f.reason}`,
        timestamp: f.timestamp,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      hours,
      count: events.length,
      events: events.slice(0, 100), // 最多返回100条
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[HEALTH] history error:', error);
    return NextResponse.json(
      { error: 'Failed to get health history' },
      { status: 500 }
    );
  }
}
