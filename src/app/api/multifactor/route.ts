import { NextRequest, NextResponse } from "next/server";
import { getKLineData, getQuote } from "@/lib/api/stock";
import { getDailyBasic, calcPercentile } from "@/lib/tushare-client";
import { analyzeChanlun } from "@/lib/analysis";
import { analyzeWaves } from "@/lib/analysis";
import { calculateStockFactors, calculatePosition, calculateSentiment, getCorrectionFactor } from "@/lib/multifactor";
import type { SentimentMode, SentimentRawData } from "@/lib/multifactor";
import { queryRaw } from "@/lib/db";

// GET: 计算个股多因子评分
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const sentimentMode = (searchParams.get("mode") || "neutral") as SentimentMode;
    const customWeightsParam = searchParams.get("weights");

    if (!code) {
      return NextResponse.json(
        { success: false, error: "缺少股票代码参数 code" },
        { status: 400 }
      );
    }

    // 获取K线数据、实时行情、估值数据（S1 因子）
    const [klineData, quoteData, dailyBasic] = await Promise.all([
      getKLineData(code, "daily", 120),
      getQuote(code),
      getDailyBasic(code, 250),
    ]);

    if (!klineData || klineData.length === 0) {
      return NextResponse.json(
        { success: false, error: "无法获取K线数据" },
        { status: 404 }
      );
    }

    const currentPrice = quoteData?.price || klineData[klineData.length - 1].close;

    // 计算估值历史分位（近 250 个交易日）
    let pePercentile: number | undefined;
    let pbPercentile: number | undefined;
    if (dailyBasic.length > 0) {
      const latest = dailyBasic[dailyBasic.length - 1];
      const peHistory = dailyBasic.map((d) => d.pe);
      const pbHistory = dailyBasic.map((d) => d.pb);
      const peP = calcPercentile(latest.pe, peHistory);
      const pbP = calcPercentile(latest.pb, pbHistory);
      if (peP !== null) pePercentile = peP;
      if (pbP !== null) pbPercentile = pbP;
    }

    // 运行缠论和波浪分析
    const chanlunResult = analyzeChanlun(klineData);
    const waveResult = analyzeWaves(klineData);

    // 从缠论信号推导当前阶段
    let chanlunStage: string | undefined;
    if (chanlunResult.buySignals.length > 0) {
      const lastBuy = chanlunResult.buySignals[chanlunResult.buySignals.length - 1];
      if (lastBuy.type === 1) chanlunStage = '一买';
      else if (lastBuy.type === 2) chanlunStage = '二买';
      else if (lastBuy.type === 3) chanlunStage = '三买';
    } else if (chanlunResult.sellSignals.length > 0) {
      const lastSell = chanlunResult.sellSignals[chanlunResult.sellSignals.length - 1];
      if (lastSell.type === 1) chanlunStage = '一卖';
      else if (lastSell.type === 2) chanlunStage = '二卖';
      else if (lastSell.type === 3) chanlunStage = '三卖';
    } else {
      chanlunStage = '震荡';
    }

    // 从波浪信号推导当前浪型
    let waveStage: string | undefined;
    if (waveResult.waves.length > 0) {
      const lastWave = waveResult.waves[waveResult.waves.length - 1];
      waveStage = lastWave.label;
    }

    // 解析自定义权重（默认为内置因子等权）
    const DEFAULT_FACTORS = [
      { key: 'S1', weight: 25 },
      { key: 'S2', weight: 25 },
      { key: 'S3', weight: 20 },
      { key: 'S4', weight: 15 },
      { key: 'S5', weight: 15 },
    ];
    let selectedFactors = DEFAULT_FACTORS;
    if (customWeightsParam) {
      try {
        const weights = JSON.parse(customWeightsParam);
        selectedFactors = Object.entries(weights).map(([key, weight]) => ({
          key,
          weight: weight as number,
        }));
      } catch {
        // 使用默认权重
      }
    }

    // 计算个股因子评分
    const stockResult = calculateStockFactors({
      klineData,
      currentPrice,
      pePercentile,
      pbPercentile,
      chanlunSignal: chanlunStage,
      wavePosition: waveStage,
      selectedFactors: selectedFactors as { key: import("@/lib/multifactor/types").StockFactorKey; weight: number }[],
    });

    // 获取最新情绪数据（从数据库）
    let sentimentScore = 0;
    let correctionFactor = 1.0;
    try {
      const { rows } = await queryRaw<{ sentiment_score: number }>(
        `SELECT sentiment_score FROM sentiment_snapshot ORDER BY timestamp DESC LIMIT 1`
      );
      if (rows.length > 0 && rows[0].sentiment_score !== null) {
        sentimentScore = Number(rows[0].sentiment_score);
        correctionFactor = getCorrectionFactor(sentimentScore, sentimentMode);
      }
    } catch {
      // 数据库查询失败时使用默认值
    }

    // 计算仓位
    const positionResult = calculatePosition(
      stockResult.totalScore,
      sentimentScore,
      sentimentMode
    );

    // 保存仓位计算日志
    const positionLabel = positionResult.finalPosition >= 80 ? '重仓' : positionResult.finalPosition >= 50 ? '中等仓位' : positionResult.finalPosition >= 20 ? '轻仓' : positionResult.finalPosition > 0 ? '极轻仓' : '空仓';
    try {
      await queryRaw(
        `INSERT INTO position_log (code, factor_scores, total_score, base_position, sentiment_score, correction_factor, final_position, position_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          code,
          JSON.stringify(stockResult.factors),
          stockResult.totalScore,
          positionResult.basePosition,
          sentimentScore,
          correctionFactor,
          positionResult.finalPosition,
          positionLabel,
        ]
      );
    } catch {
      // 日志写入失败不影响主流程
    }

    return NextResponse.json({
      success: true,
      data: {
        code,
        stockFactors: stockResult,
        valuation: dailyBasic.length > 0 ? {
          pe: dailyBasic[dailyBasic.length - 1].pe,
          pb: dailyBasic[dailyBasic.length - 1].pb,
          pePercentile: pePercentile ?? null,
          pbPercentile: pbPercentile ?? null,
          turnoverRate: dailyBasic[dailyBasic.length - 1].turnoverRate,
        } : null,
        sentimentScore,
        sentimentMode,
        correctionFactor,
        position: positionResult,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "多因子分析失败: " + errorMsg },
      { status: 500 }
    );
  }
}

// POST: 接收情绪数据推送并计算情绪评分
export async function POST(request: NextRequest) {
  try {
    // 验证推送Token
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.PUSH_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { success: false, error: "未授权访问" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 构建情绪原始数据（字段名与 SentimentRawData 类型一致，使用 snake_case）
    const rawData: SentimentRawData = {
      total_volume: body.total_volume,
      volume_change_pct: body.volume_change_pct,
      turnover_rate: body.turnover_rate,
      turnover_change_pct: body.turnover_change_pct,
      limit_up_count: body.limit_up_count,
      limit_up_change_pct: body.limit_up_change_pct,
      limit_down_count: body.limit_down_count,
      limit_down_change_pct: body.limit_down_change_pct,
      margin_balance: body.margin_balance,
      margin_change_pct: body.margin_change_pct,
    };

    // 计算情绪评分
    const sentimentResult = calculateSentiment(rawData);

    // 保存情绪快照到数据库
    await queryRaw(
      `INSERT INTO sentiment_snapshot
       (timestamp, total_volume, volume_change_pct, turnover_rate, turnover_change_pct,
        limit_up_count, limit_up_change_pct, limit_down_count, limit_down_change_pct,
        margin_balance, margin_change_pct, sentiment_score, heat_level, factor_scores, raw_data)
       VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        rawData.total_volume,
        rawData.volume_change_pct,
        rawData.turnover_rate,
        rawData.turnover_change_pct,
        rawData.limit_up_count,
        rawData.limit_up_change_pct,
        rawData.limit_down_count,
        rawData.limit_down_change_pct,
        rawData.margin_balance,
        rawData.margin_change_pct,
        sentimentResult.totalScore,
        sentimentResult.heatLevel,
        JSON.stringify(sentimentResult.factors),
        JSON.stringify(rawData),
      ]
    );

    return NextResponse.json({
      success: true,
      data: sentimentResult,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "情绪数据保存失败: " + errorMsg },
      { status: 500 }
    );
  }
}
