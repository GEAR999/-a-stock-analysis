import { neon, Pool, types } from '@neondatabase/serverless';

// 修复 pg 驱动默认将 numeric/decimal 返回为字符串的问题，统一转为 number
const typeParsers = {
  getTypeParser: (oid: number) => {
    // 1700 = numeric, 700 = float4, 701 = float8, 790 = money
    if (oid === 1700 || oid === 700 || oid === 701 || oid === 790) {
      return (val: string) => (val === null ? null : parseFloat(val));
    }
    return types.getTypeParser(oid);
  },
};

// Neon serverless driver - lazy initialization
let _sql: ReturnType<typeof neon> | null = null;
let _pool: Pool | null = null;

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

function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _pool = new Pool({
      connectionString: url,
      types: typeParsers as any,
    });
  }
  return _pool;
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

/**
 * 执行原始 SQL 字符串（用于迁移等场景，SQL 中无参数插值）
 * 使用 Pool 客户端执行，支持多条语句
 */
export async function execRaw(sqlText: string): Promise<unknown> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(sqlText);
    return result;
  } finally {
    client.release();
  }
}

/**
 * 使用 Pool 执行带参数的查询（用于 migration 中的 information_schema 查询等）
 */
export async function queryRaw<T = Record<string, unknown>>(
  sqlText: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(sqlText, params);
    return { rows: result.rows as T[] };
  } finally {
    client.release();
  }
}

export default query;
