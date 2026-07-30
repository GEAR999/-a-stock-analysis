import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-at-least-32-characters-long!'
);

/** 无需登录即可访问的路径（精确匹配或前缀匹配） */
const PUBLIC_PATHS = [
  '/login',
  '/api/ping',          // 健康检查（systemd health-check.sh）
  '/api/auth/login',
  '/api/auth/register', // 是否开放注册由 route 内 DISABLE_REGISTRATION 控制
  '/api/auth/me',       // 登录态探测，未登录时 route 自行返回未授权
  '/api/auth/logout',
];

const STATIC_EXT = /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Next.js 内部资源与静态文件
  if (pathname.startsWith('/_next') || STATIC_EXT.test(pathname)) {
    return NextResponse.next();
  }

  // 白名单路径
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Bearer Token 请求（李富贵推送/服务端到服务端/内部自调用）
  // 精确比对 PUSH_TOKEN；各推送 route 内仍有二次校验
  const authHeader = request.headers.get('authorization');
  const pushToken = process.env.PUSH_TOKEN;
  if (pushToken && authHeader === `Bearer ${pushToken}`) {
    return NextResponse.next();
  }

  // Cookie JWT 校验
  const token = request.cookies.get('auth-token')?.value;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch {
      // token 无效/过期，按未登录处理
    }
  }

  // 未登录：API 返回 401，页面重定向到登录页
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: '未登录或登录已过期' },
      { status: 401 }
    );
  }
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
