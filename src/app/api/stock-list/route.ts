import { NextRequest, NextResponse } from "next/server";
import { queryRaw } from "@/lib/db";
import { getStockBasicList } from "@/lib/tushare-client";

/**
 * 股票列表接口（本地化搜索，替代东方财富搜索）
 *
 * POST /api/stock-list — 从 Tushare stock_basic 全量同步到数据库
 *   Header: Authorization: Bearer <PUSH_TOKEN>（管理操作，需鉴权）
 *
 * GET /api/stock-list?keyword=xxx&limit=20 — 本地搜索（代码/名称/拼音首字母）
 */

// POST: 从 Tushare 全量同步股票列表
export async function POST(request: NextRequest) {
  // 鉴权：与 multifactor POST 一致的管理员 Token
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.PUSH_TOKEN;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { success: false, error: "未授权" },
      { status: 401 }
    );
  }

  try {
    const stocks = await getStockBasicList();
    if (stocks.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tushare 返回空股票列表，未执行同步" },
        { status: 502 }
      );
    }

    // 批量 upsert（分片执行，每片 500 条，避免单条 SQL 过长）
    const CHUNK_SIZE = 500;
    let upserted = 0;
    for (let i = 0; i < stocks.length; i += CHUNK_SIZE) {
      const chunk = stocks.slice(i, i + CHUNK_SIZE);
      const values: string[] = [];
      const params: (string | null)[] = [];
      chunk.forEach((s, idx) => {
        const base = idx * 5;
        values.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, NOW())`
        );
        params.push(s.code, s.name, s.market, s.industry, s.listDate);
      });

      await queryRaw(
        `INSERT INTO stock_list (code, name, market, industry, list_date, updated_at)
         VALUES ${values.join(",")}
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           market = EXCLUDED.market,
           industry = EXCLUDED.industry,
           list_date = EXCLUDED.list_date,
           updated_at = NOW()`,
        params
      );
      upserted += chunk.length;
    }

    return NextResponse.json({
      success: true,
      data: { total: stocks.length, upserted },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[stock-list] 同步失败:", errMsg);
    return NextResponse.json(
      { success: false, error: `同步失败: ${errMsg}` },
      { status: 500 }
    );
  }
}

// GET: 本地搜索股票（代码前缀 / 名称模糊匹配）
export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword")?.trim();
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") || "20", 10) || 20,
    100
  );

  if (!keyword) {
    return NextResponse.json(
      { success: false, error: "缺少 keyword 参数" },
      { status: 400 }
    );
  }

  try {
    // 优先代码前缀匹配，其次名称包含匹配；代码匹配排前面
    const { rows } = await queryRaw<{
      code: string;
      name: string;
      market: string;
      industry: string | null;
    }>(
      `SELECT code, name, market, industry
       FROM stock_list
       WHERE code LIKE $1 || '%' OR name ILIKE '%' || $1 || '%'
       ORDER BY
         CASE WHEN code LIKE $1 || '%' THEN 0 ELSE 1 END,
         code
       LIMIT $2`,
      [keyword, limit]
    );

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        code: r.code,
        name: r.name,
        market: r.market,
        industry: r.industry,
      })),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // 表不存在时给出明确提示（需要先执行 migrate + 同步）
    if (errMsg.includes("stock_list")) {
      return NextResponse.json(
        { success: false, error: "股票列表未同步，请先执行 POST /api/stock-list" },
        { status: 503 }
      );
    }
    console.error("[stock-list] 搜索失败:", errMsg);
    return NextResponse.json(
      { success: false, error: `搜索失败: ${errMsg}` },
      { status: 500 }
    );
  }
}
