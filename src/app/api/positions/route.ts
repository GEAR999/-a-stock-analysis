import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, apiList, type AuthRequest } from '@/lib/api-utils';

// GET /api/positions?account_id=xxx
export const GET = withAuth(async (req: AuthRequest) => {
  try {
    const accountId = req.nextUrl.searchParams.get('account_id');
    if (!accountId) return apiError('缺少 account_id 参数');

    const rows = await query`
      SELECT p.*, a.user_id FROM positions p
      JOIN accounts a ON p.account_id = a.id
      WHERE p.account_id = ${accountId} AND a.user_id = ${req.user.userId}
      ORDER BY p.updated_at DESC
    `;
    return apiSuccess(rows);
  } catch (e) {
    console.error('GET /api/positions error:', e);
    return apiError('获取持仓失败', 'DB_ERROR', 500);
  }
});
