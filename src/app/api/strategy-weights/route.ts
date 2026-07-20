import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// GET /api/strategy-weights - 获取账户的策略权重配置
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

    const weights = await query`
      SELECT sw.*, st.name as strategy_name, st.description, st.theories, st.confidence
      FROM strategy_weights sw
      LEFT JOIN strategy_templates st ON sw.strategy_id = st.id
      WHERE sw.account_id = ${accountId}
      ORDER BY sw.sort_order, sw.strategy_id
    `;

    return NextResponse.json({ success: true, data: weights });
  } catch (error) {
    console.error('Failed to fetch strategy weights:', error);
    return NextResponse.json(
      { success: false, error: '获取策略权重失败' },
      { status: 500 }
    );
  }
}

// POST /api/strategy-weights - 批量保存权重配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, weights } = body;

    if (!accountId || !Array.isArray(weights)) {
      return NextResponse.json(
        { success: false, error: '缺少 accountId 或 weights 参数' },
        { status: 400 }
      );
    }

    // 删除旧权重
    await execute`
      DELETE FROM strategy_weights WHERE account_id = ${accountId}
    `;

    // 插入新权重
    const results = [];
    for (let i = 0; i < weights.length; i++) {
      const { strategyId, weight, enabled } = weights[i];
      const result = await query`
        INSERT INTO strategy_weights (account_id, strategy_id, weight, enabled, sort_order)
        VALUES (${accountId}, ${strategyId}, ${weight}, ${enabled !== false}, ${i})
        RETURNING *
      `;
      results.push(result[0]);
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('Failed to save strategy weights:', error);
    return NextResponse.json(
      { success: false, error: '保存策略权重失败' },
      { status: 500 }
    );
  }
}
