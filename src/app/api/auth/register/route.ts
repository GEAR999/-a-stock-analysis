import { NextRequest } from 'next/server';
import { hashPassword, createUser, findUserByEmail, createToken } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const { email, username, password } = await request.json();

    if (!email || !password) {
      return apiError('邮箱和密码不能为空', 'MISSING_FIELDS');
    }
    if (password.length < 6) {
      return apiError('密码至少6个字符', 'INVALID_PASSWORD');
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return apiError('该邮箱已注册', 'EMAIL_EXISTS');
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(email, username || email.split('@')[0], passwordHash);

    const token = await createToken({
      userId: user.id,
      email: user.email,
      username: user.username || '',
    });

    const response = apiSuccess({ user, token }, '注册成功');
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return apiError('注册失败，请稍后重试', 'SERVER_ERROR', 500);
  }
}
