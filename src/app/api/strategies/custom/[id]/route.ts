import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// PUT /api/strategies/custom/[id]
export const PUT = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, theories, buy_conditions, sell_conditions, position_ratio, stop_loss, take_profit, is_active } = body;

    const theoriesArr = theories ? `{${theories.join(',')}}` : null;
    await execute`
      UPDATE custom_strategies SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        theories = COALESCE(${theoriesArr}, theories),
        buy_conditions = COALESCE(${JSON.stringify(buy_conditions)}, buy_conditions),
        sell_conditions = COALESCE(${JSON.stringify(sell_conditions)}, sell_conditions),
        position_ratio = COALESCE(${position_ratio}, position_ratio),
        stop_loss = COALESCE(${stop_loss}, stop_loss),
        take_profit = COALESCE(${take_profit}, take_profit),
        is_active = COALESCE(${is_active}, is_active),
        version = version + 1,
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${req.user.userId}
    `;
    return apiSuccess({ id });
  } catch (e) {
    console.error('PUT /api/strategies/custom/[id] error:', e);
    return apiError('更新自定义策略失败', 'DB_ERROR', 500);
  }
});

// DELETE /api/strategies/custom/[id]
export const DELETE = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    await execute`DELETE FROM custom_strategies WHERE id = ${id} AND user_id = ${req.user.userId}`;
    return apiSuccess({ deleted: true });
  } catch (e) {
    console.error('DELETE /api/strategies/custom/[id] error:', e);
    return apiError('删除自定义策略失败', 'DB_ERROR', 500);
  }
});
