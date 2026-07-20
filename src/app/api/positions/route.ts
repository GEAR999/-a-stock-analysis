import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// GET /api/positions - 获取持仓列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: '缺少 accountId 参数' },
        { status: 400 }
      );
    }

    const positions = await query`
      SELECT * FROM positions WHERE account_id = ${accountId} AND quantity > 0
    `;

    return NextResponse.json({ success: true, data: positions });
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    return NextResponse.json(
      { success: false, error: '获取持仓列表失败' },
      { status: 500 }
    );
  }
}

// PUT /api/positions - 更新持仓
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, stockCode, quantity, costPrice, avgPrice } = body;

    if (!accountId || !stockCode) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    const result = await query`
      UPDATE positions SET 
        quantity = COALESCE(${quantity}, quantity),
        cost_price = COALESCE(${costPrice}, cost_price),
        avg_price = COALESCE(${avgPrice}, avg_price),
        updated_at = NOW()
      WHERE account_id = ${accountId} AND stock_code = ${stockCode}
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Failed to update position:', error);
    return NextResponse.json(
      { success: false, error: '更新持仓失败' },
      { status: 500 }
    );
  }
}
