import { NextResponse } from 'next/server';
import { runAllProbes, getHourlyStats } from '@/lib/monitor';
import { getAlertHistory } from '@/lib/alert-store';

export const dynamic = 'force-dynamic';

// 监控数据聚合 API
export async function GET() {
  try {
    // 获取数据源健康状态
    const probes = await runAllProbes(false);
    
    // 获取告警历史
    const alerts = getAlertHistory(20);
    
    // 获取请求统计
    const stats = getHourlyStats();
    
    // 计算系统健康分数 (0-100)
    let healthScore = 100;
    
    // 数据源状态扣分
    if (probes.mootdx.status !== 'ok') healthScore -= 20;
    if (probes.tushare.status !== 'ok') healthScore -= 15;
    if (probes.eastmoney.status !== 'ok') healthScore -= 10;
    
    // 请求成功率扣分
    const successRate = stats.last1h_success_rate;
    if (successRate < 1) {
      healthScore -= Math.floor((1 - successRate) * 30);
    }
    
    // 未解决告警扣分
    const unresolvedAlerts = alerts.filter(a => !a.resolved).length;
    healthScore -= Math.min(unresolvedAlerts * 5, 20);
    
    healthScore = Math.max(0, healthScore);
    
    // 确定整体状态
    let overall: 'ok' | 'degraded' | 'down' = 'ok';
    if (healthScore < 60) overall = 'down';
    else if (healthScore < 80) overall = 'degraded';
    
    // 计算性能指标
    const latencies = [probes.mootdx.latency, probes.tushare.latency, probes.eastmoney.latency].filter(l => l > 0);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    
    // 计算成功/失败数
    const total = stats.last1h_requests;
    const success = Math.round(total * stats.last1h_success_rate);
    const failed = total - success;
    
    return NextResponse.json({
      overall,
      healthScore,
      timestamp: new Date().toISOString(),
      mootdx: {
        status: probes.mootdx.status,
        latency: probes.mootdx.latency,
        lastCheck: probes.mootdx.lastCheck,
        lastError: probes.mootdx.lastError,
      },
      tushare: {
        status: probes.tushare.status,
        latency: probes.tushare.latency,
        lastCheck: probes.tushare.lastCheck,
        lastError: probes.tushare.lastError,
      },
      eastmoney: {
        status: probes.eastmoney.status,
        latency: probes.eastmoney.latency,
        lastCheck: probes.eastmoney.lastCheck,
        lastError: probes.eastmoney.lastError,
      },
      stats: {
        total,
        success,
        failed,
        fallback: stats.last1h_fallback_count,
      },
      alerts: {
        total: alerts.length,
        unresolved: unresolvedAlerts,
        recent: alerts.slice(0, 5),
      },
      performance: {
        avgLatency: stats.last1h_avg_latency,
        maxLatency,
        uptime: total > 0 ? (successRate * 100).toFixed(1) + '%' : 'N/A',
      },
    });
  } catch (error) {
    return NextResponse.json({
      overall: 'down',
      healthScore: 0,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
