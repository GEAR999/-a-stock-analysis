import { NextResponse } from "next/server";
import { queryRaw } from "@/lib/db";

// GET: 查询央行利率数据
export async function GET() {
  try {
    const { rows } = await queryRaw(
      `SELECT * FROM central_bank_rates ORDER BY updated_at DESC`
    );

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "查询央行利率失败: " + errorMsg },
      { status: 500 }
    );
  }
}
