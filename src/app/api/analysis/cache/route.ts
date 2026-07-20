import { query, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { NextRequest } from 'next/server';

// GET /api/analysis/cache?stock_code=xxx&analysis_type=chanlun
export async function GET(req: NextRequest) {
  try {
    const stockCode = req.nextUrl.searchParams.get('stock_code');
    const analysisType = req.nextUrl.searchParams.get('analysis_type');

    if (!stockCode || !analysisType) return apiError('缺少必要参数');

    const rows = await query`
      SELECT * FROM analysis_cache
      WHERE stock_code = ${stockCode} AND analysis_type = ${analysisType}
      AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY computed_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) return apiSuccess(null, 'no cache');
    return apiSuccess(rows[0]);
  } catch (e) {
    console.error('GET /api/analysis/cache error:', e);
    return apiError('获取分析缓存失败', 'DB_ERROR', 500);
  }
}

// POST /api/analysis/cache - 保存分析缓存
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stock_code, analysis_type, result, score, signal, ttl_minutes = 60 } = body;

    if (!stock_code || !analysis_type || !result) return apiError('缺少必要参数');

    const expiresAt = new Date(Date.now() + ttl_minutes * 60 * 1000).toISOString();

    const rows = await execute<{ id: string }>`
      INSERT INTO analysis_cache (stock_code, analysis_type, result, score, signal, expires_at)
      VALUES (${stock_code}, ${analysis_type}, ${JSON.stringify(result)}, ${score || null}, ${signal || null}, ${expiresAt})
      RETURNING id
    `;
    return apiSuccess({ id: rows[0].id });
  } catch (e) {
    console.error('POST /api/analysis/cache error:', e);
    return apiError('保存分析缓存失败', 'DB_ERROR', 500);
  }
}
