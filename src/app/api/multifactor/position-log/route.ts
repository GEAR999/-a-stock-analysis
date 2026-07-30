import { NextRequest, NextResponse } from "next/server";
import { queryRaw } from "@/lib/db";

// GET: 查询个股仓位计算历史
// /api/multifactor/position-log?code=600519&limit=100
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

    if (!code) {
      return NextResponse.json(
        { success: false, error: "缺少股票代码参数 code" },
        { status: 400 }
      );
    }

    const { rows } = await queryRaw<{
      id: string;
      code: string;
      strategy_id: string | null;
      total_score: string | number;
      base_position: string | number;
      sentiment_score: string | number;
      correction_factor: string | number;
      final_position: string | number;
      position_label: string | null;
      timestamp: string;
    }>(
      `SELECT id, code, strategy_id, total_score, base_position, sentiment_score,
              correction_factor, final_position, position_label, timestamp
       FROM position_log
       WHERE code = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [code, limit]
    );

    // DECIMAL 列返回字符串，统一转数值；按时间升序返回（图表从左到右）
    const data = rows
      .map((r) => ({
        id: r.id,
        code: r.code,
        strategyId: r.strategy_id,
        totalScore: Number(r.total_score),
        basePosition: Number(r.base_position),
        sentimentScore: Number(r.sentiment_score),
        correctionFactor: Number(r.correction_factor),
        finalPosition: Number(r.final_position),
        positionLabel: r.position_label,
        timestamp: r.timestamp,
      }))
      .reverse();

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "查询仓位历史失败: " + errorMsg },
      { status: 500 }
    );
  }
}
