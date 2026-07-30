import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";

const RETENTION_DAYS = 30;

interface IndexData {
  price?: number;
  change_pct?: number;
}

interface MarketStats {
  advance_count?: number;
  decline_count?: number;
  limit_up?: number;
  limit_down?: number;
  total_volume?: number;
}

interface WatchlistItem {
  code: string;
  name: string;
  price?: number;
  change_pct?: number;
}

interface PushData {
  timestamp: string;
  shanghai_index?: IndexData;
  shenzhen_index?: IndexData;
  chinext_index?: IndexData;
  market_stats?: MarketStats;
  watchlist_etf?: WatchlistItem[];
  watchlist_stock?: WatchlistItem[];
}

interface MarketParamsRow {
  id: number;
  timestamp: string | Date;
  sh_price: number | null;
  sh_change_pct: number | null;
  sz_price: number | null;
  sz_change_pct: number | null;
  cyb_price: number | null;
  cyb_change_pct: number | null;
  advance_count: number | null;
  decline_count: number | null;
  limit_up: number | null;
  limit_down: number | null;
  total_volume: number | null;
  watchlist_data: unknown;
  created_at: string | Date;
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toInteger(value: unknown): number | null {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeWatchlist(value: unknown): WatchlistItem[] {
  if (!Array.isArray(value)) return [];

  const result: WatchlistItem[] = [];
  for (const item of value) {
    const record = item as Partial<WatchlistItem>;
    if (!record.code || !record.name) continue;

    const normalized: WatchlistItem = {
      code: String(record.code),
      name: String(record.name),
    };

    const price = toNumber(record.price);
    const changePct = toNumber(record.change_pct);
    if (price !== null) normalized.price = price;
    if (changePct !== null) normalized.change_pct = changePct;

    result.push(normalized);
  }

  return result;
}

function parseWatchlistData(value: unknown): { etf: WatchlistItem[]; stock: WatchlistItem[] } | null {
  if (!value) return null;

  let obj: unknown = value;
  if (typeof value === "string") {
    try {
      obj = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (typeof obj !== "object" || obj === null) return null;
  const record = obj as Record<string, unknown>;

  return {
    etf: normalizeWatchlist(record.etf),
    stock: normalizeWatchlist(record.stock),
  };
}

export async function POST(request: NextRequest) {
  try {
    const pushToken = process.env.PUSH_TOKEN;
    if (!pushToken) {
      return NextResponse.json(
        { success: false, error: "Server misconfigured: PUSH_TOKEN is not set" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${pushToken}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let data: PushData;
    try {
      data = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (!data.timestamp || isNaN(Date.parse(data.timestamp))) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing timestamp" },
        { status: 400 }
      );
    }

    const watchlistData = {
      etf: normalizeWatchlist(data.watchlist_etf),
      stock: normalizeWatchlist(data.watchlist_stock),
    };

    const rows = await query<{ id: number }>`
      INSERT INTO realtime_market_params (
        timestamp,
        sh_price,
        sh_change_pct,
        sz_price,
        sz_change_pct,
        cyb_price,
        cyb_change_pct,
        advance_count,
        decline_count,
        limit_up,
        limit_down,
        total_volume,
        watchlist_data,
        created_at
      ) VALUES (
        ${data.timestamp},
        ${toNumber(data.shanghai_index?.price)},
        ${toNumber(data.shanghai_index?.change_pct)},
        ${toNumber(data.shenzhen_index?.price)},
        ${toNumber(data.shenzhen_index?.change_pct)},
        ${toNumber(data.chinext_index?.price)},
        ${toNumber(data.chinext_index?.change_pct)},
        ${toInteger(data.market_stats?.advance_count)},
        ${toInteger(data.market_stats?.decline_count)},
        ${toInteger(data.market_stats?.limit_up)},
        ${toInteger(data.market_stats?.limit_down)},
        ${toNumber(data.market_stats?.total_volume)},
        ${JSON.stringify(watchlistData)}::jsonb,
        NOW()
      )
      RETURNING id
    `;

    return NextResponse.json({
      success: true,
      message: "数据接收成功",
      data: { id: rows[0]?.id },
    });
  } catch (error: unknown) {
    console.error("[market-params] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "1", 10) || 1, 100);

    try {
      await execute`
        DELETE FROM realtime_market_params
        WHERE created_at < NOW() - (${RETENTION_DAYS} || ' days')::interval
      `;
    } catch (cleanupError) {
      console.warn("[market-params] cleanup warning:", cleanupError);
    }

    const rows = await query<MarketParamsRow>`
      SELECT
        id,
        timestamp,
        sh_price,
        sh_change_pct,
        sz_price,
        sz_change_pct,
        cyb_price,
        cyb_change_pct,
        advance_count,
        decline_count,
        limit_up,
        limit_down,
        total_volume,
        watchlist_data,
        created_at
      FROM realtime_market_params
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    const formatted = rows.map((row) => {
      const parsed = parseWatchlistData(row.watchlist_data);
      return {
        id: row.id,
        timestamp: row.timestamp,
        sh_price: row.sh_price,
        sh_change_pct: row.sh_change_pct,
        sz_price: row.sz_price,
        sz_change_pct: row.sz_change_pct,
        cyb_price: row.cyb_price,
        cyb_change_pct: row.cyb_change_pct,
        advance_count: row.advance_count,
        decline_count: row.decline_count,
        limit_up: row.limit_up,
        limit_down: row.limit_down,
        total_volume: row.total_volume,
        watchlist_data: parsed,
        created_at: row.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        latest: formatted[0] || null,
        history: formatted,
      },
    });
  } catch (error: unknown) {
    console.error("[market-params] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch market params" },
      { status: 500 }
    );
  }
}
