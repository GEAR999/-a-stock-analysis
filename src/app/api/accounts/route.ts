import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// GET /api/accounts - 获取当前用户所有账户
export const GET = withAuth(async (req: AuthRequest) => {
  try {
    const rows = await query<{
      id: string; name: string; type: string; initial_capital: string;
      current_capital: string; quant_threshold: string; auto_trade: boolean;
      max_position_ratio: string; stop_loss_ratio: string; take_profit_ratio: string;
      created_at: string; updated_at: string;
    }>`SELECT * FROM accounts WHERE user_id = ${req.user.userId} ORDER BY updated_at DESC`;

    return apiSuccess(rows);
  } catch (e) {
    console.error('GET /api/accounts error:', e);
    return apiError('获取账户列表失败', 'DB_ERROR', 500);
  }
});

// POST /api/accounts - 创建新账户
export const POST = withAuth(async (req: AuthRequest) => {
  try {
    const body = await req.json();
    const { name, type = 'manual', initialCapital = 1000000 } = body;

    if (!name || typeof name !== 'string') {
      return apiError('账户名称不能为空');
    }

    const rows = await execute<{ id: string }>`
      INSERT INTO accounts (user_id, name, type, initial_capital, current_capital)
      VALUES (${req.user.userId}, ${name}, ${type}, ${initialCapital}, ${initialCapital})
      RETURNING id
    `;

    return apiSuccess({ id: rows[0].id, name, type, initialCapital, currentCapital: initialCapital });
  } catch (e) {
    console.error('POST /api/accounts error:', e);
    return apiError('创建账户失败', 'DB_ERROR', 500);
  }
});
