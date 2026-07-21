import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/accounts/[id] - 获取单个账户完整信息
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const accounts = await query`
      SELECT * FROM accounts WHERE id = ${id}
    `;

    if (accounts.length === 0) {
      return NextResponse.json(
        { success: false, error: '账户不存在' },
        { status: 404 }
      );
    }

    const account = accounts[0];

    // 获取持仓
    const positions = await query`
      SELECT * FROM positions WHERE account_id = ${id} AND quantity > 0
    `;

    // 获取交易记录
    const transactions = await query`
      SELECT * FROM transactions WHERE account_id = ${id} ORDER BY traded_at DESC LIMIT 100
    `;

    return NextResponse.json({
      success: true,
      data: {
        ...account,
        positions,
        transactions,
      },
    });
  } catch (error) {
    console.error('Failed to fetch account:', error);
    return NextResponse.json(
      { success: false, error: '获取账户详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/accounts/[id] - 更新账户信息
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, quant_threshold, auto_trade, max_position_ratio, stop_loss_ratio, take_profit_ratio } = body;

    const account = await query`
      UPDATE accounts SET 
        name = COALESCE(${name}, name),
        quant_threshold = COALESCE(${quant_threshold}, quant_threshold),
        auto_trade = COALESCE(${auto_trade}, auto_trade),
        max_position_ratio = COALESCE(${max_position_ratio}, max_position_ratio),
        stop_loss_ratio = COALESCE(${stop_loss_ratio}, stop_loss_ratio),
        take_profit_ratio = COALESCE(${take_profit_ratio}, take_profit_ratio),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: account[0] });
  } catch (error) {
    console.error('Failed to update account:', error);
    return NextResponse.json(
      { success: false, error: '更新账户失败' },
      { status: 500 }
    );
  }
}
