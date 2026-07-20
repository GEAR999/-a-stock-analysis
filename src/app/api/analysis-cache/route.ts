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
        ORDER BY updated_at DESC LIMIT 1
      `;
    } else {
      cache = await query`
        SELECT * FROM analysis_cache 
        WHERE stock_code = ${stockCode}
        ORDER BY updated_at DESC
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
    const { stockCode, analysisType, resultData } = body;

    if (!stockCode || !analysisType || !resultData) {
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

    let result;
    if (existing.length > 0) {
      // 更新
      result = await query`
        UPDATE analysis_cache 
        SET result_data = ${JSON.stringify(resultData)}, updated_at = NOW()
        WHERE stock_code = ${stockCode} AND analysis_type = ${analysisType}
        RETURNING *
      `;
    } else {
      // 插入
      result = await query`
        INSERT INTO analysis_cache (stock_code, analysis_type, result_data)
        VALUES (${stockCode}, ${analysisType}, ${JSON.stringify(resultData)})
        RETURNING *
      `;
    }

    return NextResponse.json({ success: true, data: result[0] });
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
    const daysOld = parseInt(searchParams.get('daysOld') || '7');

    if (stockCode) {
      // 删除特定股票的缓存
      await execute`
        DELETE FROM analysis_cache WHERE stock_code = ${stockCode}
      `;
    } else {
      // 删除过期缓存
      await execute`
        DELETE FROM analysis_cache WHERE updated_at < NOW() - INTERVAL '${daysOld} days'
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete analysis cache:', error);
    return NextResponse.json(
      { success: false, error: '删除分析缓存失败' },
      { status: 500 }
    );
  }
}
