import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// GET /api/analysis-cache - 获取缓存的分析结果
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stockCode = searchParams.get('stockCode');
    const analysisType = searchParams.get('type');

    if (!stockCode) {
      return NextResponse.json(
        { success: false, error: '缺少 stockCode 参数' },
        { status: 400 }
      );
    }

    let cache;
    if (analysisType) {
      cache = await query`
        SELECT * FROM analysis_cache 
        WHERE stock_code = ${stockCode} AND analysis_type = ${analysisType}
        ORDER BY computed_at DESC LIMIT 1
      `;
    } else {
      cache = await query`
        SELECT * FROM analysis_cache 
        WHERE stock_code = ${stockCode}
        ORDER BY computed_at DESC
      `;
    }

    return NextResponse.json({ success: true, data: cache });
  } catch (error) {
    console.error('Failed to fetch analysis cache:', error);
    return NextResponse.json(
      { success: false, error: '获取分析缓存失败' },
      { status: 500 }
    );
  }
}

// POST /api/analysis-cache - 保存分析结果缓存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stockCode, analysisType, result, score, signal, expiresAt } = body;

    if (!stockCode || !analysisType || !result) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 检查是否已存在
    const existing = await query`
      SELECT * FROM analysis_cache 
      WHERE stock_code = ${stockCode} AND analysis_type = ${analysisType}
    `;

    let cacheResult;
    if (existing.length > 0) {
      // 更新
      cacheResult = await query`
        UPDATE analysis_cache 
        SET result = ${JSON.stringify(result)}, score = ${score || null}, signal = ${signal || null}, computed_at = NOW(), expires_at = ${expiresAt || null}
        WHERE stock_code = ${stockCode} AND analysis_type = ${analysisType}
        RETURNING *
      `;
    } else {
      // 插入
      cacheResult = await query`
        INSERT INTO analysis_cache (stock_code, analysis_type, result, score, signal, expires_at)
        VALUES (${stockCode}, ${analysisType}, ${JSON.stringify(result)}, ${score || null}, ${signal || null}, ${expiresAt || null})
        RETURNING *
      `;
    }

    return NextResponse.json({ success: true, data: cacheResult[0] });
  } catch (error) {
    console.error('Failed to save analysis cache:', error);
    return NextResponse.json(
      { success: false, error: '保存分析缓存失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/analysis-cache - 清理过期缓存
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stockCode = searchParams.get('stockCode');

    if (stockCode) {
      await execute`
        DELETE FROM analysis_cache WHERE stock_code = ${stockCode}
      `;
    } else {
      // 清理过期缓存
      await execute`
        DELETE FROM analysis_cache WHERE expires_at IS NOT NULL AND expires_at < NOW()
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear analysis cache:', error);
    return NextResponse.json(
      { success: false, error: '清理缓存失败' },
      { status: 500 }
    );
  }
}
