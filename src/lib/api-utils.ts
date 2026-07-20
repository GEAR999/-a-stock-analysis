import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, type JWTPayload } from '@/lib/auth';

export interface AuthRequest extends NextRequest {
  user: JWTPayload;
}

export async function authenticate(request: NextRequest): Promise<JWTPayload | null> {
  const token = request.cookies.get('auth-token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload;
}

/**
 * 需要认证的 API handler 包装器
 * context.params 使用 Record<string, string> 以兼容所有动态路由
 */
export function withAuth(
  handler: (req: AuthRequest, context: { params: Promise<Record<string, string>> }) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    const user = await authenticate(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: '未授权，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    return handler({ ...req, user } as AuthRequest, context);
  };
}

export function apiSuccess(data: unknown, message = 'success') {
  return NextResponse.json({ ok: true, data, message });
}

export function apiList(data: unknown[], total: number, page: number, pageSize: number) {
  return NextResponse.json({ ok: true, data, total, page, pageSize });
}

export function apiError(error: string, code = 'ERROR', status = 400) {
  return NextResponse.json({ ok: false, error, code }, { status });
}
