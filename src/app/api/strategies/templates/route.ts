import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// GET /api/strategies/templates - 获取用户策略模板
export const GET = withAuth(async (req: AuthRequest) => {
  try {
    const rows = await query`
      SELECT * FROM strategy_templates WHERE user_id = ${req.user.userId} ORDER BY updated_at DESC
    `;
    return apiSuccess(rows);
  } catch (e) {
    console.error('GET /api/strategies/templates error:', e);
    return apiError('获取策略模板失败', 'DB_ERROR', 500);
  }
});

// POST /api/strategies/templates - 创建策略模板
export const POST = withAuth(async (req: AuthRequest) => {
  try {
    const body = await req.json();
    const { name, description, config, is_default = false } = body;

    if (!name || !config) return apiError('缺少必要参数');

    const rows = await execute<{ id: string }>`
      INSERT INTO strategy_templates (user_id, name, description, config, is_default)
      VALUES (${req.user.userId}, ${name}, ${description || null}, ${JSON.stringify(config)}, ${is_default})
      RETURNING id
    `;
    return apiSuccess({ id: rows[0].id });
  } catch (e) {
    console.error('POST /api/strategies/templates error:', e);
    return apiError('创建策略模板失败', 'DB_ERROR', 500);
  }
});

// PUT /api/strategies/templates/[id]
export const PUT = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, config, is_default } = body;

    await execute`
      UPDATE strategy_templates SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        config = COALESCE(${JSON.stringify(config)}, config),
        is_default = COALESCE(${is_default}, is_default),
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${req.user.userId}
    `;
    return apiSuccess({ id });
  } catch (e) {
    console.error('PUT /api/strategies/templates error:', e);
    return apiError('更新策略模板失败', 'DB_ERROR', 500);
  }
});

// DELETE /api/strategies/templates/[id]
export const DELETE = withAuth(async (req: AuthRequest, { params }: { params: Promise<Record<string, string>> }) => {
  try {
    const { id } = await params;
    await execute`DELETE FROM strategy_templates WHERE id = ${id} AND user_id = ${req.user.userId}`;
    return apiSuccess({ deleted: true });
  } catch (e) {
    console.error('DELETE /api/strategies/templates error:', e);
    return apiError('删除策略模板失败', 'DB_ERROR', 500);
  }
});
