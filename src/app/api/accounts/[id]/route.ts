import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// GET /api/accounts/[id]
export const GET = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    const rows = await query`SELECT * FROM accounts WHERE id = ${id} AND user_id = ${req.user.userId}`;
    if (rows.length === 0) return apiError('账户不存在', 'NOT_FOUND', 404);
    return apiSuccess(rows[0]);
  } catch (e) {
    console.error('GET /api/accounts/[id] error:', e);
    return apiError('获取账户失败', 'DB_ERROR', 500);
  }
});

// PUT /api/accounts/[id]
export const PUT = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, current_capital, quant_threshold, auto_trade, max_position_ratio, stop_loss_ratio, take_profit_ratio } = body;

    await execute`
      UPDATE accounts SET
        name = COALESCE(${name}, name),
        current_capital = COALESCE(${current_capital}, current_capital),
        quant_threshold = COALESCE(${quant_threshold}, quant_threshold),
        auto_trade = COALESCE(${auto_trade}, auto_trade),
        max_position_ratio = COALESCE(${max_position_ratio}, max_position_ratio),
        stop_loss_ratio = COALESCE(${stop_loss_ratio}, stop_loss_ratio),
        take_profit_ratio = COALESCE(${take_profit_ratio}, take_profit_ratio),
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${req.user.userId}
    `;
    return apiSuccess({ id });
  } catch (e) {
    console.error('PUT /api/accounts/[id] error:', e);
    return apiError('更新账户失败', 'DB_ERROR', 500);
  }
});

// DELETE /api/accounts/[id]
export const DELETE = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    await execute`DELETE FROM accounts WHERE id = ${id} AND user_id = ${req.user.userId}`;
    return apiSuccess({ deleted: true });
  } catch (e) {
    console.error('DELETE /api/accounts/[id] error:', e);
    return apiError('删除账户失败', 'DB_ERROR', 500);
  }
});
