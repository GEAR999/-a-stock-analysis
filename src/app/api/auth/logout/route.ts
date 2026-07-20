import { NextResponse } from 'next/server';
import { apiSuccess } from '@/lib/api-utils';

export async function POST() {
  const response = NextResponse.json({ ok: true, message: '已登出' });
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
