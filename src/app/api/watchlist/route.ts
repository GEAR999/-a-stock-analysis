import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// GET /api/watchlist - 获取自选股列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';

    // UUID 格式校验：如果不是合法 UUID，返回空列表（兼容旧数据）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json({ success: true, data: [] });
    }

    const watchlist = await query`
      SELECT * FROM watchlist WHERE user_id = ${userId} ORDER BY sort_order, added_at
    `;

    return NextResponse.json({ success: true, data: watchlist });
  } catch (error) {
    console.error('Failed to fetch watchlist:', error);
    return NextResponse.json(
      { success: false, error: '获取自选股列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/watchlist - 添加自选股
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, stockCode, stockName, groupName, alertPriceHigh, alertPriceLow, note } = body;
    const uid = userId || 'default';

    if (!stockCode) {
      return NextResponse.json(
        { success: false, error: '缺少股票代码' },
        { status: 400 }
      );
    }

    // UUID 格式校验
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uid)) {
      return NextResponse.json({ success: true, data: null, message: '无效的用户ID' });
    }

    // 检查是否已存在
    const existing = await query`
      SELECT * FROM watchlist WHERE user_id = ${uid} AND stock_code = ${stockCode} AND group_name = ${groupName || '默认'}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: '已在自选股中' }, { status: 400 });
    }

    // 获取最大排序号
    const maxSort = await query`
      SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM watchlist WHERE user_id = ${uid}
    `;
    const sortOrder = Number(maxSort[0].max_sort) + 1;

    const result = await query`
      INSERT INTO watchlist (user_id, stock_code, stock_name, group_name, alert_price_high, alert_price_low, note, sort_order)
      VALUES (${uid}, ${stockCode}, ${stockName || ''}, ${groupName || '默认'}, ${alertPriceHigh || null}, ${alertPriceLow || null}, ${note || null}, ${sortOrder})
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Failed to add watchlist:', error);
    return NextResponse.json(
      { success: false, error: '添加自选股失败' },
      { status: 500 }
    );
  }
}

// PUT /api/watchlist - 更新自选股（排序、备注等）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, stockCode, groupName, sortOrder, note, alertPriceHigh, alertPriceLow } = body;
    const uid = userId || 'default';

    const result = await query`
      UPDATE watchlist SET
        sort_order = COALESCE(${sortOrder}, sort_order),
        note = COALESCE(${note}, note),
        alert_price_high = COALESCE(${alertPriceHigh}, alert_price_high),
        alert_price_low = COALESCE(${alertPriceLow}, alert_price_low),
        group_name = COALESCE(${groupName}, group_name)
      WHERE user_id = ${uid} AND stock_code = ${stockCode}
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Failed to update watchlist:', error);
    return NextResponse.json(
      { success: false, error: '更新自选股失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/watchlist - 删除自选股
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    const stockCode = searchParams.get('stockCode');

    if (!stockCode) {
      return NextResponse.json(
        { success: false, error: '缺少股票代码' },
        { status: 400 }
      );
    }

    await execute`
      DELETE FROM watchlist WHERE user_id = ${userId} AND stock_code = ${stockCode}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete watchlist:', error);
    return NextResponse.json(
      { success: false, error: '删除自选股失败' },
      { status: 500 }
    );
  }
}
