/**
 * 健康汇总 API
 * GET /api/health/summary
 * 
 * 返回三个数据源实时状态 + 请求统计
 */

import { NextResponse } from 'next/server';
import { runAllProbes, getHourlyStats, getAllSourceStates, getFallbackHistory } from '@/lib/monitor';
import type { HealthSummary, SourceStatus, DataSourceName } from '@/lib/monitor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 执行探针检测（使用缓存避免高频调用）
    const probes = await runAllProbes(false);

    // 构建汇总数据
    const buildSummary = (probe: { status: SourceStatus; latency: number; lastCheck: string; lastError: string | null }) => ({
      status: probe.status,
      latency: probe.latency,
      lastCheck: probe.lastCheck,
      lastError: probe.lastError,
    });

    const mootdxSummary = buildSummary(probes.mootdx);
    const tushareSummary = buildSummary(probes.tushare);
    const eastmoneySummary = buildSummary(probes.eastmoney);

    // 总体状态：全部ok=ok，有一个降级=degraded，全部down=down
    const statuses: SourceStatus[] = [probes.mootdx.status, probes.tushare.status, probes.eastmoney.status];
    let overall: SourceStatus = 'ok';
    if (statuses.every(s => s === 'down')) {
      overall = 'down';
    } else if (statuses.some(s => s !== 'ok')) {
      overall = 'degraded';
    }

    const stats = getHourlyStats();

    const summary: HealthSummary = {
      mootdx: mootdxSummary,
      tushare: tushareSummary,
      eastmoney: eastmoneySummary,
      overall,
      timestamp: new Date().toISOString(),
      stats,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[HEALTH] summary error:', error);
    return NextResponse.json(
      {
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
