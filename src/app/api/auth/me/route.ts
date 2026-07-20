import { withAuth, apiSuccess, type AuthRequest } from '@/lib/api-utils';
import { findUserById } from '@/lib/auth';

// GET - 获取当前登录用户信息
export const GET = withAuth(async (req: AuthRequest) => {
  const user = await findUserById(req.user.userId);
  if (!user) {
    return apiSuccess(null);
  }
  return apiSuccess({ id: user.id, email: user.email, username: user.username });
});
