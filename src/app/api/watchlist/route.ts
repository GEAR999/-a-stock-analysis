import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// GET /api/watchlist
export const GET = withAuth(async (req: AuthRequest) => {
  try {
    const rows = await query`
      SELECT * FROM watchlist WHERE user_id = ${req.user.userId} ORDER BY sort_order, added_at DESC
    `;
    return apiSuccess(rows);
  } catch (e) {
    console.error('GET /api/watchlist error:', e);
    return apiError('获取自选股失败', 'DB_ERROR', 500);
  }
});

// POST /api/watchlist - 添加自选股
export const POST = withAuth(async (req: AuthRequest) => {
  try {
    const body = await req.json();
    const { stock_code, stock_name, group_name = '默认', alert_price_high, alert_price_low, note, sort_order = 0 } = body;

    if (!stock_code || !stock_name) return apiError('缺少股票代码或名称');

    const rows = await execute<{ id: string }>`
      INSERT INTO watchlist (user_id, stock_code, stock_name, group_name, alert_price_high, alert_price_low, note, sort_order)
      VALUES (${req.user.userId}, ${stock_code}, ${stock_name}, ${group_name}, ${alert_price_high || null}, ${alert_price_low || null}, ${note || null}, ${sort_order})
      ON CONFLICT (user_id, stock_code, group_name) DO NOTHING
      RETURNING id
    `;
    return apiSuccess({ id: rows[0]?.id || null });
  } catch (e) {
    console.error('POST /api/watchlist error:', e);
    return apiError('添加自选股失败', 'DB_ERROR', 500);
  }
});

// DELETE /api/watchlist - 删除自选股
export const DELETE = withAuth(async (req: AuthRequest) => {
  try {
    const stockCode = req.nextUrl.searchParams.get('stock_code');
    const groupName = req.nextUrl.searchParams.get('group_name') || '默认';

    if (!stockCode) return apiError('缺少股票代码');

    await execute`
      DELETE FROM watchlist WHERE user_id = ${req.user.userId} AND stock_code = ${stockCode} AND group_name = ${groupName}
    `;
    return apiSuccess({ deleted: true });
  } catch (e) {
    console.error('DELETE /api/watchlist error:', e);
    return apiError('删除自选股失败', 'DB_ERROR', 500);
  }
});
