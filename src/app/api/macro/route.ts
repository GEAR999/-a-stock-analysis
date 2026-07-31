import { NextResponse } from "next/server";
import { queryRaw } from "@/lib/db";

// GET: 查询宏观经济数据（中国/美国）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || "china"; // china | us
    const limit = parseInt(searchParams.get("limit") || "12");
    const period = searchParams.get("period");

    const tableName = region === "us" ? "macro_us" : "macro_china";

    let query = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    if (period) {
      query += ` WHERE period = $1`;
      params.push(period);
    }

    query += ` ORDER BY period DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await queryRaw(query, params);

    return NextResponse.json({
      success: true,
      data: rows,
      region,
      count: rows.length,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "查询宏观数据失败: " + errorMsg },
      { status: 500 }
    );
  }
}
