import { neon } from '@neondatabase/serverless';

// Neon serverless driver - lazy initialization
let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(url);
  }
  return _sql;
}

/**
 * 执行 SQL 查询并返回结果数组
 * 使用示例：
 *   const rows = await query<{ id: string; name: string }>`SELECT * FROM users WHERE id = ${id}`
 */
export async function query<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const sql = getSql();
  const result = await sql(strings, ...values);
  return result as unknown as T[];
}

/**
 * 执行 SQL 语句（INSERT/UPDATE/DELETE），返回受影响的行
 */
export async function execute<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const sql = getSql();
  const result = await sql(strings, ...values);
  return result as unknown as T[];
}

export default query;
