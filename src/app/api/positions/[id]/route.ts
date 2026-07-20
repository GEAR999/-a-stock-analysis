import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// PUT /api/positions/[id]
export const PUT = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const { quantity, current_price, market_value, profit_loss, profit_loss_ratio } = body;

    await execute`
      UPDATE positions SET
        quantity = COALESCE(${quantity}, quantity),
        current_price = COALESCE(${current_price}, current_price),
        market_value = COALESCE(${market_value}, market_value),
        profit_loss = COALESCE(${profit_loss}, profit_loss),
        profit_loss_ratio = COALESCE(${profit_loss_ratio}, profit_loss_ratio),
        updated_at = NOW()
      WHERE id = ${id}
    `;
    return apiSuccess({ id });
  } catch (e) {
    console.error('PUT /api/positions/[id] error:', e);
    return apiError('更新持仓失败', 'DB_ERROR', 500);
  }
});
