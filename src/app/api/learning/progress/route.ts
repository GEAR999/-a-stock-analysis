import { query, execute } from '@/lib/db';
import { withAuth, apiSuccess, apiError, type AuthRequest } from '@/lib/api-utils';

// GET /api/learning/progress?module=xxx
export const GET = withAuth(async (req: AuthRequest) => {
  try {
    const moduleName = req.nextUrl.searchParams.get('module');

    let rows;
    if (moduleName) {
      rows = await query`
        SELECT * FROM learning_progress
        WHERE user_id = ${req.user.userId} AND module = ${moduleName}
        ORDER BY last_accessed_at DESC
      `;
    } else {
      rows = await query`
        SELECT * FROM learning_progress
        WHERE user_id = ${req.user.userId}
        ORDER BY last_accessed_at DESC
      `;
    }
    return apiSuccess(rows);
  } catch (e) {
    console.error('GET /api/learning/progress error:', e);
    return apiError('获取学习进度失败', 'DB_ERROR', 500);
  }
});

// PUT /api/learning/progress - 更新学习进度（upsert）
export const PUT = withAuth(async (req: AuthRequest) => {
  try {
    const body = await req.json();
    const { module: moduleName, lesson_id, status = 'in_progress', progress = 0, notes } = body;

    if (!moduleName || !lesson_id) return apiError('缺少必要参数');

    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    await execute`
      INSERT INTO learning_progress (user_id, module, lesson_id, status, progress, notes, completed_at)
      VALUES (${req.user.userId}, ${moduleName}, ${lesson_id}, ${status}, ${progress}, ${notes || null}, ${completedAt})
      ON CONFLICT (user_id, module, lesson_id) DO UPDATE SET
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        notes = COALESCE(EXCLUDED.notes, learning_progress.notes),
        last_accessed_at = NOW(),
        completed_at = COALESCE(EXCLUDED.completed_at, learning_progress.completed_at)
    `;
    return apiSuccess({ module: moduleName, lesson_id });
  } catch (e) {
    console.error('PUT /api/learning/progress error:', e);
    return apiError('更新学习进度失败', 'DB_ERROR', 500);
  }
});
