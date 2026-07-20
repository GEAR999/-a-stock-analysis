import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// GET /api/strategies/custom - 获取用户自定义策略
export const GET = withAuth(async (req: AuthRequest) => {
  try {
    const rows = await query`
      SELECT * FROM custom_strategies WHERE user_id = ${req.user.userId} ORDER BY updated_at DESC
    `;
    return apiSuccess(rows);
  } catch (e) {
    console.error('GET /api/strategies/custom error:', e);
    return apiError('获取自定义策略失败', 'DB_ERROR', 500);
  }
});

// POST /api/strategies/custom - 创建自定义策略
export const POST = withAuth(async (req: AuthRequest) => {
  try {
    const body = await req.json();
    const { name, description, theories, buy_conditions, sell_conditions, position_ratio, stop_loss, take_profit } = body;

    if (!name) return apiError('策略名称不能为空');

    const rows = await execute<{ id: string }>`
      INSERT INTO custom_strategies (user_id, name, description, theories, buy_conditions, sell_conditions, position_ratio, stop_loss, take_profit)
      VALUES (${req.user.userId}, ${name}, ${description || null}, ${JSON.stringify(theories || [])}, ${JSON.stringify(buy_conditions || {})}, ${JSON.stringify(sell_conditions || {})}, ${position_ratio || 0.25}, ${stop_loss || 0.05}, ${take_profit || 0.10})
      RETURNING id
    `;
    return apiSuccess({ id: rows[0].id });
  } catch (e) {
    console.error('POST /api/strategies/custom error:', e);
    return apiError('创建自定义策略失败', 'DB_ERROR', 500);
  }
});
