import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// GET /api/transactions/[id]
export const GET = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    const rows = await query`
      SELECT t.*, a.user_id FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ${id} AND a.user_id = ${req.user.userId}
    `;
    if (rows.length === 0) return apiError('交易记录不存在', 'NOT_FOUND', 404);
    return apiSuccess(rows[0]);
  } catch (e) {
    console.error('GET /api/transactions/[id] error:', e);
    return apiError('获取交易记录失败', 'DB_ERROR', 500);
  }
});

// DELETE /api/transactions/[id]
export const DELETE = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    await execute`
      DELETE FROM transactions WHERE id = ${id} AND account_id IN (
        SELECT id FROM accounts WHERE user_id = ${req.user.userId}
      )
    `;
    return apiSuccess({ deleted: true });
  } catch (e) {
    console.error('DELETE /api/transactions/[id] error:', e);
    return apiError('删除交易记录失败', 'DB_ERROR', 500);
  }
});
