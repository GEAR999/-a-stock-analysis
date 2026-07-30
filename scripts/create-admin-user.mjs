#!/usr/bin/env node
/**
 * 创建管理员账号脚本（生产环境注册关闭后使用）
 *
 * 用法：
 *   node scripts/create-admin-user.mjs <email> <password> [username]
 *
 * 示例：
 *   node scripts/create-admin-user.mjs admin@example.com 'MyPass123' 李大
 *
 * 说明：
 * - 需要 DATABASE_URL 环境变量（自动读取项目根目录 .env / .env.local）
 * - 邮箱已存在时会更新密码
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// 手动加载 .env / .env.local（不依赖 dotenv）
for (const name of ['.env.local', '.env']) {
  const p = resolve(projectRoot, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key]) continue;
    process.env[key] = rawVal.replace(/^["']|["']$/g, '');
  }
}

const [email, password, username] = process.argv.slice(2);
if (!email || !password) {
  console.error('用法: node scripts/create-admin-user.mjs <email> <password> [username]');
  process.exit(1);
}
if (password.length < 6) {
  console.error('密码至少 6 个字符');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 未配置（检查 .env / .env.local）');
  process.exit(1);
}

const { neon } = await import('@neondatabase/serverless');
const bcrypt = await import('bcryptjs');

const sql = neon(process.env.DATABASE_URL);
const passwordHash = await bcrypt.hash(password, 12);
const name = username || email.split('@')[0];

const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
if (existing.length > 0) {
  await sql`UPDATE users SET password_hash = ${passwordHash}, username = ${name}, updated_at = NOW() WHERE email = ${email}`;
  console.log(`✅ 用户已存在，密码已重置: ${email}`);
} else {
  await sql`INSERT INTO users (email, username, password_hash) VALUES (${email}, ${name}, ${passwordHash})`;
  console.log(`✅ 用户创建成功: ${email} (${name})`);
}
