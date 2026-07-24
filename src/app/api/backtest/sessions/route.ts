import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * 回测会话接口
 * GET /api/backtest/sessions - 查询回测会话列表
 * POST /api/backtest/sessions - 保存回测会话
 */

// 查询回测会话列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'saved';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await query`
      SELECT *
      FROM backtest_sessions
      WHERE status = ${status}
      ORDER BY saved_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      success: true,
      data: result,
      total: result.length,
    });
  } catch (error) {
    console.error('[Backtest Sessions] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// 保存回测会话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      account_id,
      account_name,
      initial_capital,
      current_capital,
      total_return,
      max_drawdown,
      sharpe_ratio,
      win_rate,
      trade_count,
      config,
      results,
    } = body;

    if (!account_id || !account_name || !initial_capital) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await query`
      INSERT INTO backtest_sessions (
        account_id, account_name, initial_capital, current_capital,
        total_return, max_drawdown, sharpe_ratio, win_rate, trade_count,
        config, results, status, saved_at
      )
      VALUES (
        ${account_id}, ${account_name}, ${initial_capital}, ${current_capital || initial_capital},
        ${total_return || 0}, ${max_drawdown || 0}, ${sharpe_ratio || 0}, ${win_rate || 0}, ${trade_count || 0},
        ${JSON.stringify(config)}, ${JSON.stringify(results)}, 'saved', NOW()
      )
      RETURNING id
    `;

    return NextResponse.json({
      success: true,
      data: { id: result[0]?.id },
    });
  } catch (error) {
    console.error('[Backtest Sessions] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save session' },
      { status: 500 }
    );
  }
}
