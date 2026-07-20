import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// GET /api/strategies/weights?account_id=xxx
export const GET = withAuth(async (req: AuthRequest) => {
  try {
    const accountId = req.nextUrl.searchParams.get('account_id');
    if (!accountId) return apiError('缺少 account_id 参数');

    const rows = await query`
      SELECT sw.* FROM strategy_weights sw
      JOIN accounts a ON sw.account_id = a.id
      WHERE sw.account_id = ${accountId} AND a.user_id = ${req.user.userId}
      ORDER BY sw.sort_order
    `;
    return apiSuccess(rows);
  } catch (e) {
    console.error('GET /api/strategies/weights error:', e);
    return apiError('获取策略权重失败', 'DB_ERROR', 500);
  }
});

// POST /api/strategies/weights - 批量保存权重
export const POST = withAuth(async (req: AuthRequest) => {
  try {
    const body = await req.json();
    const { account_id, weights } = body;

    if (!account_id || !Array.isArray(weights)) return apiError('参数错误');

    // 先删除旧权重
    await execute`DELETE FROM strategy_weights WHERE account_id = ${account_id}`;

    // 批量插入新权重
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i];
      await execute`
        INSERT INTO strategy_weights (account_id, strategy_id, strategy_name, strategy_type, weight, confidence, is_enabled, sort_order)
        VALUES (${account_id}, ${w.strategyId}, ${w.strategyName}, ${w.strategyType || 'builtin'}, ${w.weight}, ${w.confidence || 0.7}, ${w.enabled !== false}, ${i})
      `;
    }

    return apiSuccess({ saved: weights.length });
  } catch (e) {
    console.error('POST /api/strategies/weights error:', e);
    return apiError('保存策略权重失败', 'DB_ERROR', 500);
  }
});
