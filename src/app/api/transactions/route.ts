import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, apiList, type AuthRequest } from '@/lib/api-utils';

// GET /api/transactions?account_id=xxx&page=1&pageSize=50
export const GET = withAuth(async (req: AuthRequest) => {
  try {
    const accountId = req.nextUrl.searchParams.get('account_id');
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
    const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;

    if (!accountId) return apiError('缺少 account_id 参数');

    const rows = await query`
      SELECT t.*, a.user_id FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.account_id = ${accountId} AND a.user_id = ${req.user.userId}
      ORDER BY t.traded_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countRows = await query<{ count: string }>`
      SELECT COUNT(*) as count FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.account_id = ${accountId} AND a.user_id = ${req.user.userId}
    `;
    const total = parseInt(countRows[0]?.count || '0');

    return apiList(rows, total, page, pageSize);
  } catch (e) {
    console.error('GET /api/transactions error:', e);
    return apiError('获取交易记录失败', 'DB_ERROR', 500);
  }
});

// POST /api/transactions - 创建交易
export const POST = withAuth(async (req: AuthRequest) => {
  try {
    const body = await req.json();
    const { account_id, stock_code, stock_name, type, price, quantity, amount, fee = 0, strategy_signals, note, traded_at } = body;

    if (!account_id || !stock_code || !type || !price || !quantity) {
      return apiError('缺少必要参数');
    }

    const rows = await execute<{ id: string }>`
      INSERT INTO transactions (account_id, stock_code, stock_name, type, price, quantity, amount, fee, strategy_signals, note, traded_at)
      VALUES (${account_id}, ${stock_code}, ${stock_name}, ${type}, ${price}, ${quantity}, ${amount}, ${fee}, ${strategy_signals ? JSON.stringify(strategy_signals) : null}, ${note || null}, ${traded_at || new Date().toISOString()})
      RETURNING id
    `;
    return apiSuccess({ id: rows[0].id });
  } catch (e) {
    console.error('POST /api/transactions error:', e);
    return apiError('创建交易失败', 'DB_ERROR', 500);
  }
});
