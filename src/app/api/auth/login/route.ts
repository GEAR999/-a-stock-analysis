import { NextRequest } from 'next/server';
import { verifyPassword, findUserByEmail, createToken } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return apiError('邮箱和密码不能为空', 'MISSING_FIELDS');
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return apiError('邮箱或密码错误', 'INVALID_CREDENTIALS');
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return apiError('邮箱或密码错误', 'INVALID_CREDENTIALS');
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      username: user.username || '',
    });

    const response = apiSuccess({
      user: { id: user.id, email: user.email, username: user.username },
      token,
    }, '登录成功');

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return apiError('登录失败，请稍后重试', 'SERVER_ERROR', 500);
  }
}
