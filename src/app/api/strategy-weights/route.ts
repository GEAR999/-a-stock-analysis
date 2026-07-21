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

    // UUID 格式校验
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(accountId)) {
      return NextResponse.json({ success: true, data: [] });
    }

    const weights = await query`
      SELECT * FROM strategy_weights
      WHERE account_id = ${accountId}
      ORDER BY sort_order, strategy_id
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
      const { strategyId, strategyName, strategyType, weight, confidence, enabled } = weights[i];
      const result = await query`
        INSERT INTO strategy_weights (account_id, strategy_id, strategy_name, strategy_type, weight, confidence, is_enabled, sort_order)
        VALUES (${accountId}, ${strategyId}, ${strategyName || strategyId}, ${strategyType || 'builtin'}, ${weight}, ${confidence || 0.70}, ${enabled !== false}, ${i})
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
