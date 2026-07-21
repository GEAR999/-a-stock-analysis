import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/accounts - 获取所有账户列表
export async function GET() {
  try {
    const accounts = await query`
      SELECT id, user_id, name, type, initial_capital, current_capital, 
             quant_threshold, auto_trade, max_position_ratio, stop_loss_ratio, take_profit_ratio,
             created_at, updated_at
      FROM accounts
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return NextResponse.json(
      { success: false, error: '获取账户列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/accounts - 创建新账户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, type, initial_capital, quant_threshold, auto_trade, max_position_ratio, stop_loss_ratio, take_profit_ratio } = body;

    if (!name || !type || !initial_capital) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    const result = await query`
      INSERT INTO accounts (user_id, name, type, initial_capital, current_capital, quant_threshold, auto_trade, max_position_ratio, stop_loss_ratio, take_profit_ratio)
      VALUES (${user_id || null}, ${name}, ${type}, ${initial_capital}, ${initial_capital}, ${quant_threshold || 70}, ${auto_trade || false}, ${max_position_ratio || 0.25}, ${stop_loss_ratio || 0.05}, ${take_profit_ratio || 0.10})
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Failed to create account:', error);
    return NextResponse.json(
      { success: false, error: '创建账户失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/accounts - 删除账户
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: '缺少账户ID' },
        { status: 400 }
      );
    }

    await query`DELETE FROM accounts WHERE id = ${accountId}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return NextResponse.json(
      { success: false, error: '删除账户失败' },
      { status: 500 }
    );
  }
}
