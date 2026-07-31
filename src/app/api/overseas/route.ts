import { NextResponse } from "next/server";
import { queryRaw } from "@/lib/db";

// GET: 查询海外股价数据
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "30");
    const trade_date = searchParams.get("trade_date");

    let query = `SELECT * FROM overseas_prices`;
    const params: any[] = [];

    if (trade_date) {
      query += ` WHERE trade_date = $1`;
      params.push(trade_date);
    }

    query += ` ORDER BY trade_date DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await queryRaw(query, params);

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "查询海外股价数据失败: " + errorMsg },
      { status: 500 }
    );
  }
}
