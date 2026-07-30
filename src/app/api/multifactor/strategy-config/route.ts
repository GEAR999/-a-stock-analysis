import { NextRequest, NextResponse } from "next/server";
import { queryRaw } from "@/lib/db";
import type { SentimentMode } from "@/lib/multifactor";

const VALID_MODES: SentimentMode[] = ["contrarian", "trend_follow", "neutral"];

// GET: 读取策略的情绪模式与因子权重配置
// /api/multifactor/strategy-config?strategy_id=builtin_xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get("strategy_id");

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: "缺少 strategy_id 参数" },
        { status: 400 }
      );
    }

    const { rows } = await queryRaw<{
      strategy_id: string;
      sentiment_mode: string;
      custom_weights: Record<string, number> | null;
    }>(
      `SELECT strategy_id, sentiment_mode, custom_weights
       FROM strategy_sentiment_config WHERE strategy_id = $1`,
      [strategyId]
    );

    if (rows.length === 0) {
      // 无配置：返回默认值（中性模式，无自定义权重）
      return NextResponse.json({
        success: true,
        data: {
          strategyId,
          sentimentMode: "neutral" as SentimentMode,
          customWeights: null,
          isDefault: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        strategyId: rows[0].strategy_id,
        sentimentMode: rows[0].sentiment_mode as SentimentMode,
        customWeights: rows[0].custom_weights,
        isDefault: false,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "读取策略情绪配置失败: " + errorMsg },
      { status: 500 }
    );
  }
}

// POST: 保存策略的情绪模式与因子权重配置（upsert）
// body: { strategyId, sentimentMode, customWeights? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategyId, sentimentMode, customWeights } = body as {
      strategyId?: string;
      sentimentMode?: SentimentMode;
      customWeights?: Record<string, number> | null;
    };

    if (!strategyId || typeof strategyId !== "string") {
      return NextResponse.json(
        { success: false, error: "缺少 strategyId" },
        { status: 400 }
      );
    }
    if (!sentimentMode || !VALID_MODES.includes(sentimentMode)) {
      return NextResponse.json(
        { success: false, error: "sentimentMode 必须是 contrarian / trend_follow / neutral" },
        { status: 400 }
      );
    }

    await queryRaw(
      `INSERT INTO strategy_sentiment_config (strategy_id, sentiment_mode, custom_weights, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (strategy_id)
       DO UPDATE SET sentiment_mode = $2, custom_weights = $3, updated_at = NOW()`,
      [strategyId, sentimentMode, customWeights ? JSON.stringify(customWeights) : null]
    );

    return NextResponse.json({
      success: true,
      data: { strategyId, sentimentMode, customWeights: customWeights ?? null },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "保存策略情绪配置失败: " + errorMsg },
      { status: 500 }
    );
  }
}
