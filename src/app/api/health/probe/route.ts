/**
 * 手动触发探针 API
 * POST /api/health/probe
 * 
 * 强制触发一次全量探针检测，清除缓存
 */

import { NextResponse } from 'next/server';
import { runAllProbes, clearProbeCache, checkRecovery } from '@/lib/monitor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    // 清除缓存
    clearProbeCache();

    // 强制全量探针
    const probes = await runAllProbes(true);

    // 检查是否有数据源恢复
    const recovered = await checkRecovery();

    return NextResponse.json({
      success: true,
      probes,
      recovered,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[HEALTH] probe trigger error:', error);
    return NextResponse.json(
      { error: 'Probe trigger failed' },
      { status: 500 }
    );
  }
}

// 也支持GET方式触发（方便测试）
export async function GET() {
  return POST();
}
