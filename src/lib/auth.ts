import { SignJWT, jwtVerify } from 'jose';
import { hash, compare } from 'bcryptjs';
import { query, execute } from '@/lib/db';

// ===== JWT 工具 =====

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-at-least-32-characters-long!'
);

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// ===== 密码工具 =====

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hashStr: string): Promise<boolean> {
  return compare(password, hashStr);
}

// ===== 用户数据库操作 =====

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

interface UserPublicRow {
  id: string;
  email: string;
  username: string | null;
  created_at: string;
  updated_at: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await query<UserRow>`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
  return rows[0] || null;
}

export async function findUserById(id: string): Promise<UserPublicRow | null> {
  const rows = await query<UserPublicRow>`SELECT id, email, username, created_at, updated_at FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

export async function createUser(email: string, username: string, passwordHash: string): Promise<UserPublicRow> {
  const rows = await execute<UserPublicRow>`
    INSERT INTO users (email, username, password_hash) 
    VALUES (${email}, ${username}, ${passwordHash})
    RETURNING id, email, username, created_at, updated_at
  `;
  return rows[0];
}
