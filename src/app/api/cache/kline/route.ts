import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * K 线缓存接口
 * GET /api/cache/kline?code=600549&period=daily&is_realtime=false - 查询缓存
 * POST /api/cache/kline - 写入缓存
 * DELETE /api/cache/kline?code=600549&period=daily - 删除缓存
 */

// 查询 K 线缓存
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const period = searchParams.get('period');
    const isRealtime = searchParams.get('is_realtime') === 'true';

    if (!code || !period) {
      return NextResponse.json(
        { success: false, error: 'Missing code or period' },
        { status: 400 }
      );
    }

    const result = await query`
      SELECT data, source, expires_at, hit_count
      FROM kline_cache
      WHERE stock_code = ${code} 
        AND period = ${period} 
        AND is_realtime = ${isRealtime}
        AND expires_at > NOW()
    `;

    if (result.length === 0) {
      return NextResponse.json({
        success: true,
        cached: false,
        data: null,
      });
    }

    // 更新命中次数
    await query`
      UPDATE kline_cache
      SET hit_count = hit_count + 1, last_hit_at = NOW()
      WHERE stock_code = ${code} 
        AND period = ${period} 
        AND is_realtime = ${isRealtime}
    `;

    return NextResponse.json({
      success: true,
      cached: true,
      data: result[0].data,
      source: result[0].source,
      expiresAt: result[0].expires_at,
      hitCount: result[0].hit_count,
    });
  } catch (error) {
    console.error('[Kline Cache] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cache' },
      { status: 500 }
    );
  }
}

// 写入 K 线缓存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, period, data, source, isRealtime } = body;

    if (!code || !period || !data || !source) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 计算过期时间
    const expiresAt = new Date();
    if (isRealtime) {
      expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 实时数据 5 分钟
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7); // 历史数据 7 天
    }

    await query`
      INSERT INTO kline_cache (stock_code, period, data, source, is_realtime, expires_at)
      VALUES (${code}, ${period}, ${JSON.stringify(data)}, ${source}, ${isRealtime}, ${expiresAt})
      ON CONFLICT (stock_code, period, is_realtime)
      DO UPDATE SET
        data = EXCLUDED.data,
        source = EXCLUDED.source,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW()
    `;

    return NextResponse.json({
      success: true,
      expiresAt,
    });
  } catch (error) {
    console.error('[Kline Cache] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save cache' },
      { status: 500 }
    );
  }
}

// 删除 K 线缓存
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const period = searchParams.get('period');

    if (!code || !period) {
      return NextResponse.json(
        { success: false, error: 'Missing code or period' },
        { status: 400 }
      );
    }

    await query`
      DELETE FROM kline_cache
      WHERE stock_code = ${code} AND period = ${period}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Kline Cache] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete cache' },
      { status: 500 }
    );
  }
}
