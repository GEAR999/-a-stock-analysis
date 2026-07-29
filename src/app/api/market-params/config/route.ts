import { NextRequest, NextResponse } from "next/server";
import { query, queryRaw } from "@/lib/db";

interface WatchlistItem {
  code: string;
  name: string;
  price?: number;
  change_pct?: number;
}

interface ConfigRow {
  id: number;
  user_id: string;
  watchlist_etf: unknown;
  watchlist_stock: unknown;
  push_token: string;
  push_times: string[] | string;
  update_interval: number;
  data_retention_days: number;
  created_at: string | Date;
  updated_at: string | Date;
}

const DEFAULT_WATCHLIST_ETF: WatchlistItem[] = [
  { code: "sh513120", name: "港股创新药ETF" },
  { code: "sh513330", name: "恒生互联网ETF" },
  { code: "sz159516", name: "半导体设备ETF" },
];

const DEFAULT_WATCHLIST_STOCK: WatchlistItem[] = [
  { code: "sz300308", name: "中际旭创" },
  { code: "hk09988", name: "阿里巴巴" },
];

const DEFAULT_PUSH_TIMES = ["09:35", "10:00", "10:30", "13:05", "14:00", "14:45"];

function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeWatchlist(value: unknown): WatchlistItem[] {
  const result: WatchlistItem[] = [];

  for (const item of parseArray<Partial<WatchlistItem>>(value)) {
    if (!item.code || !item.name) continue;

    const normalized: WatchlistItem = {
      code: String(item.code),
      name: String(item.name),
    };

    const price = Number(item.price);
    const changePct = Number(item.change_pct);
    if (Number.isFinite(price)) normalized.price = price;
    if (Number.isFinite(changePct)) normalized.change_pct = changePct;

    result.push(normalized);
  }

  return result;
}

function normalizePushTimes(value: unknown): string[] {
  return parseArray<string>(value).filter((time) => /^\d{2}:\d{2}$/.test(time));
}

function maskPushToken(token: string | undefined): string | null {
  if (!token) return null;
  return `****${token.slice(-4)}`;
}

function toClientConfig(row: ConfigRow) {
  return {
    id: row.id,
    user_id: row.user_id,
    watchlist_etf: normalizeWatchlist(row.watchlist_etf),
    watchlist_stock: normalizeWatchlist(row.watchlist_stock),
    push_times: normalizePushTimes(row.push_times),
    update_interval: row.update_interval,
    data_retention_days: row.data_retention_days,
    push_token_configured: Boolean(process.env.PUSH_TOKEN),
    push_token_hint: maskPushToken(process.env.PUSH_TOKEN),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getLatestConfig(): Promise<ConfigRow | null> {
  const rows = await query<ConfigRow>`
    SELECT * FROM market_params_config
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function ensureConfig(): Promise<ConfigRow> {
  const existing = await getLatestConfig();
  if (existing) return existing;

  const rows = await query<ConfigRow>`
    INSERT INTO market_params_config (
      user_id,
      watchlist_etf,
      watchlist_stock,
      push_token,
      push_times,
      update_interval,
      data_retention_days
    ) VALUES (
      ${"00000000-0000-0000-0000-000000000000"},
      ${JSON.stringify(DEFAULT_WATCHLIST_ETF)}::jsonb,
      ${JSON.stringify(DEFAULT_WATCHLIST_STOCK)}::jsonb,
      ${"env-managed"},
      ${DEFAULT_PUSH_TIMES},
      ${60},
      ${30}
    )
    RETURNING *
  `;

  return rows[0];
}

export async function GET() {
  try {
    const config = await ensureConfig();
    return NextResponse.json({ success: true, data: toClientConfig(config) });
  } catch (error: unknown) {
    console.error("[market-params/config] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch config" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const config = await ensureConfig();
    return NextResponse.json({ success: true, data: toClientConfig(config) });
  } catch (error: unknown) {
    console.error("[market-params/config] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.push_token !== undefined) {
      return NextResponse.json(
        { success: false, error: "push_token 只能通过服务端环境变量 PUSH_TOKEN 配置" },
        { status: 400 }
      );
    }

    const existing = await getLatestConfig();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Config not found" },
        { status: 404 }
      );
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];

    const addField = (field: string, value: unknown, cast = "") => {
      values.push(value);
      setClauses.push(`${field} = $${values.length}${cast}`);
    };

    if (body.watchlist_etf !== undefined) {
      if (!Array.isArray(body.watchlist_etf)) {
        return NextResponse.json(
          { success: false, error: "watchlist_etf must be an array" },
          { status: 400 }
        );
      }
      addField("watchlist_etf", JSON.stringify(normalizeWatchlist(body.watchlist_etf)), "::jsonb");
    }

    if (body.watchlist_stock !== undefined) {
      if (!Array.isArray(body.watchlist_stock)) {
        return NextResponse.json(
          { success: false, error: "watchlist_stock must be an array" },
          { status: 400 }
        );
      }
      addField("watchlist_stock", JSON.stringify(normalizeWatchlist(body.watchlist_stock)), "::jsonb");
    }

    if (body.push_times !== undefined) {
      if (!Array.isArray(body.push_times)) {
        return NextResponse.json(
          { success: false, error: "push_times must be an array" },
          { status: 400 }
        );
      }
      addField("push_times", normalizePushTimes(body.push_times));
    }

    if (body.update_interval !== undefined) {
      const interval = Number(body.update_interval);
      if (!Number.isFinite(interval) || interval < 10 || interval > 1440) {
        return NextResponse.json(
          { success: false, error: "update_interval must be between 10 and 1440" },
          { status: 400 }
        );
      }
      addField("update_interval", Math.floor(interval));
    }

    if (body.data_retention_days !== undefined) {
      const days = Number(body.data_retention_days);
      if (!Number.isFinite(days) || days < 1 || days > 365) {
        return NextResponse.json(
          { success: false, error: "data_retention_days must be between 1 and 365" },
          { status: 400 }
        );
      }
      addField("data_retention_days", Math.floor(days));
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    values.push(existing.id);
    const sql = `
      UPDATE market_params_config
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `;

    const result = await queryRaw<ConfigRow>(sql, values);
    return NextResponse.json({ success: true, data: toClientConfig(result.rows[0]) });
  } catch (error: unknown) {
    console.error("[market-params/config] PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update config" },
      { status: 500 }
    );
  }
}
