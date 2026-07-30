/**
 * Tushare Pro 服务端客户端
 *
 * 系统统一数据源（替代 mootdx/东方财富）：
 * - K线数据：pro_bar（前复权，2000积分）/ daily / weekly / monthly
 * - 估值数据：daily_basic（PE/PB/换手率，2000积分）
 * - 股票列表：stock_basic（全量 A 股，用于本地化搜索）
 *
 * Token 仅存在于服务端环境变量 TUSHARE_TOKEN，绝不暴露给前端。
 */

import type { KLineData } from "@/lib/types";

const TUSHARE_API_URL = "http://api.tushare.pro";
const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN || "";

// ============ 基础调用 ============

interface TushareResponse {
  code: number;
  data: { fields: string[]; items: (string | number | null)[][] } | null;
  message: string;
}

/**
 * 调用 Tushare Pro API，返回按字段名映射的对象数组
 */
export async function callTushare(
  apiName: string,
  params: Record<string, string>,
  fields?: string,
  timeoutMs = 15000
): Promise<Record<string, string | number | null>[]> {
  if (!TUSHARE_TOKEN) {
    console.warn("[tushare] TUSHARE_TOKEN 未配置");
    return [];
  }

  try {
    const response = await fetch(TUSHARE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_name: apiName,
        token: TUSHARE_TOKEN,
        params,
        fields: fields || "",
      }),
      signal: AbortSignal.timeout(timeoutMs),
      // Tushare 接口不允许缓存（Next.js fetch 默认缓存会导致数据过期）
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[tushare] ${apiName} HTTP ${response.status}`);
      return [];
    }

    const result: TushareResponse = await response.json();
    if (result.code !== 0 || !result.data) {
      console.warn(`[tushare] ${apiName} 返回错误: ${result.message || "空数据"}`);
      return [];
    }

    const { fields: fieldNames, items } = result.data;
    return items.map((row) => {
      const obj: Record<string, string | number | null> = {};
      fieldNames.forEach((name, idx) => {
        obj[name] = row[idx];
      });
      return obj;
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[tushare] ${apiName} 请求异常: ${errMsg}`);
    return [];
  }
}

// ============ 股票代码转换 ============

/**
 * 系统内部代码 → Tushare 代码
 * 600519 → 600519.SH | 000001/300308 → .SZ | 8xxxxx/4xxxxx → .BJ
 */
export function toTushareCode(code: string): string {
  const clean = code.replace(/[^0-9]/g, "");
  if (clean.startsWith("6")) return `${clean}.SH`;
  if (clean.startsWith("0") || clean.startsWith("3")) return `${clean}.SZ`;
  if (clean.startsWith("8") || clean.startsWith("4")) return `${clean}.BJ`;
  return `${clean}.SZ`;
}

/**
 * Tushare 代码 → 系统内部代码
 * 600519.SH → 600519
 */
export function fromTushareCode(tsCode: string): string {
  return tsCode.split(".")[0];
}

// ============ K线数据 ============

/**
 * 获取 K 线数据（日/周/月，前复权）
 *
 * 使用 pro_bar 接口（2000积分），数据已做前复权处理，适合技术分析。
 * 返回按日期升序排列（Tushare 原始返回为降序）。
 */
export async function getKLineFromTushare(
  code: string,
  period: "daily" | "weekly" | "monthly",
  limit = 250
): Promise<KLineData[]> {
  const tsCode = toTushareCode(code);

  // pro_bar 通过 end_date + limit 控制返回条数
  const rows = await callTushare(
    "pro_bar",
    {
      ts_code: tsCode,
      freq: period === "daily" ? "D" : period === "weekly" ? "W" : "M",
      adj: "qfq", // 前复权
      limit: String(limit),
    },
    "trade_date,open,high,low,close,vol,amount"
  );

  if (rows.length === 0) {
    // pro_bar 失败时降级到普通接口（非复权）
    const apiName = period === "daily" ? "daily" : period === "weekly" ? "weekly" : "monthly";
    const fallbackRows = await callTushare(
      apiName,
      { ts_code: tsCode, limit: String(limit) },
      "trade_date,open,high,low,close,vol,amount"
    );
    return transformKLineRows(fallbackRows);
  }

  return transformKLineRows(rows);
}

function transformKLineRows(
  rows: Record<string, string | number | null>[]
): KLineData[] {
  return rows
    .map((row) => {
      // 日期格式：YYYYMMDD → YYYY-MM-DD
      const raw = String(row.trade_date || "");
      const date =
        raw.length === 8
          ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          : raw;
      return {
        date,
        open: Number(row.open) || 0,
        high: Number(row.high) || 0,
        low: Number(row.low) || 0,
        close: Number(row.close) || 0,
        volume: Number(row.vol) || 0, // 成交量（手）
        amount: Number(row.amount) || 0, // 成交额（千元）
      };
    })
    .filter((d) => d.date && d.close > 0)
    .reverse(); // Tushare 返回降序 → 转为升序
}

// ============ 估值数据（S1 因子） ============

export interface DailyBasicData {
  tradeDate: string;
  close: number;
  turnoverRate: number | null; // 换手率（%）
  pe: number | null; // 市盈率（TTM）
  pb: number | null; // 市净率
  totalMv: number | null; // 总市值（万元）
  circMv: number | null; // 流通市值（万元）
}

/**
 * 获取每日指标（估值数据）
 * 用于多因子 S1 估值分位计算
 */
export async function getDailyBasic(
  code: string,
  limit = 250
): Promise<DailyBasicData[]> {
  const tsCode = toTushareCode(code);
  const rows = await callTushare(
    "daily_basic",
    { ts_code: tsCode, limit: String(limit) },
    "trade_date,close,turnover_rate,pe,pb,total_mv,circ_mv"
  );

  return rows
    .map((row) => {
      const raw = String(row.trade_date || "");
      const date =
        raw.length === 8
          ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          : raw;
      return {
        tradeDate: date,
        close: Number(row.close) || 0,
        turnoverRate: row.turnover_rate !== null ? Number(row.turnover_rate) : null,
        pe: row.pe !== null ? Number(row.pe) : null,
        pb: row.pb !== null ? Number(row.pb) : null,
        totalMv: row.total_mv !== null ? Number(row.total_mv) : null,
        circMv: row.circ_mv !== null ? Number(row.circ_mv) : null,
      };
    })
    .filter((d) => d.tradeDate)
    .reverse(); // 升序
}

/**
 * 计算估值历史分位（0-100）
 * 当前值在历史序列中的百分位
 */
export function calcPercentile(current: number | null, history: (number | null)[]): number | null {
  if (current === null || current <= 0) return null;
  const valid = history.filter((v): v is number => v !== null && v > 0);
  if (valid.length < 20) return null; // 历史数据太少不计算
  const below = valid.filter((v) => v < current).length;
  return Math.round((below / valid.length) * 100);
}

// ============ 股票列表（本地化搜索） ============

export interface StockBasicItem {
  code: string; // 600519
  name: string; // 贵州茅台
  market: "sh" | "sz" | "bj";
  industry: string | null; // 所属行业
  listDate: string | null; // 上市日期
}

/**
 * 获取全量 A 股股票列表
 * 用于本地化搜索（替代东方财富搜索接口）
 */
export async function getStockBasicList(): Promise<StockBasicItem[]> {
  const rows = await callTushare(
    "stock_basic",
    { list_status: "L" }, // L=上市中
    "ts_code,name,market,industry,list_date",
    30000 // 全量拉取，超时放宽到 30 秒
  );

  return rows
    .map((row) => {
      const tsCode = String(row.ts_code || "");
      const code = fromTushareCode(tsCode);
      const suffix = tsCode.split(".")[1];
      const market: "sh" | "sz" | "bj" =
        suffix === "SH" ? "sh" : suffix === "BJ" ? "bj" : "sz";
      return {
        code,
        name: String(row.name || ""),
        market,
        industry: row.industry !== null ? String(row.industry) : null,
        listDate: row.list_date !== null ? String(row.list_date) : null,
      };
    })
    .filter((s) => s.code && s.name);
}

// ============ 可用性检查 ============

export function isTushareConfigured(): boolean {
  return Boolean(TUSHARE_TOKEN);
}
