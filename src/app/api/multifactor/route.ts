import { NextRequest, NextResponse } from "next/server";
import { getKLineData, getQuote } from "@/lib/api/stock";
import { getDailyBasic, calcPercentile, getMarketTurnoverRate, getMarginBalance } from "@/lib/tushare-client";
import { analyzeChanlun } from "@/lib/analysis";
import { analyzeWaves } from "@/lib/analysis";
import { calculateStockFactors, calculatePosition, calculateSentiment } from "@/lib/multifactor";
import type { SentimentMode, SentimentRawData, StockFactorKey } from "@/lib/multifactor";
import { queryRaw } from "@/lib/db";

// GET: 计算个股多因子评分
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    let sentimentMode = (searchParams.get("mode") || "neutral") as SentimentMode;
    const customWeightsParam = searchParams.get("weights");
    const strategyId = searchParams.get("strategy_id");

    if (!code) {
      return NextResponse.json(
        { success: false, error: "缺少股票代码参数 code" },
        { status: 400 }
      );
    }

    // 获取 K 线数据、实时行情、估值数据（S1 因子）
    const [klineData, quoteData, dailyBasic] = await Promise.all([
      getKLineData(code, "daily", 120),
      getQuote(code),
      getDailyBasic(code, 250),
    ]);

    if (!klineData || klineData.length === 0) {
      return NextResponse.json(
        { success: false, error: "无法获取 K 线数据" },
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
    const DEFAULT_FACTORS: { key: StockFactorKey; weight: number }[] = [
      { key: 'S1', weight: 25 },
      { key: 'S2', weight: 25 },
      { key: 'S3', weight: 20 },
      { key: 'S4', weight: 15 },
      { key: 'S5', weight: 15 },
    ];
    let selectedFactors: { key: StockFactorKey; weight: number }[] = DEFAULT_FACTORS;
    if (customWeightsParam) {
      try {
        const weights = JSON.parse(customWeightsParam);
        selectedFactors = Object.entries(weights).map(([key, weight]) => ({
          key: key as StockFactorKey,
          weight: weight as number,
        }));
      } catch {
        // 使用默认权重
      }
    }

    // 情绪模式覆盖：strategy_id 命中配置时覆盖 mode/weights
    if (strategyId) {
      try {
        const { rows } = await queryRaw<{ sentiment_mode: string; custom_weights: any }>(
          `SELECT sentiment_mode, custom_weights FROM strategy_sentiment_config WHERE strategy_id = $1`,
          [strategyId]
        );
        if (rows.length > 0) {
          const cfg = rows[0];
          if (cfg.sentiment_mode && ['contrarian', 'trend_follow', 'neutral'].includes(cfg.sentiment_mode)) {
            sentimentMode = cfg.sentiment_mode as SentimentMode;
          }
          if (cfg.custom_weights) {
            selectedFactors = Object.entries(cfg.custom_weights).map(([key, weight]) => ({
              key: key as StockFactorKey,
              weight: weight as number,
            }));
          }
        }
      } catch {
        // 配置不存在时保持默认
      }
    }

    // 获取当前股票的情绪评分（用于修正系数）
    let sentimentScore = 0;
    try {
      const { rows: sentimentRows } = await queryRaw<{ total_score: number }>(
        `SELECT total_score FROM sentiment_snapshot ORDER BY created_at DESC LIMIT 1`
      );
      if (sentimentRows.length > 0) {
        sentimentScore = sentimentRows[0].total_score || 0;
      }
    } catch {
      // 情绪数据缺失时使用默认值 0
    }

    // 计算多因子评分（必须传 StockFactorInput 对象）
    const stockFactors = calculateStockFactors({
      klineData,
      currentPrice,
      pePercentile,
      pbPercentile,
      chanlunSignal: chanlunStage,
      wavePosition: waveStage,
      selectedFactors,
    });

    // 计算仓位建议（参数：综合评分, 情绪评分, 情绪模式）
    const position = calculatePosition(
      stockFactors.totalScore,
      sentimentScore,
      sentimentMode
    );

    // 修正系数从 position 结果中取
    const correctionFactor = position.correctionFactor;

    // 保存仓位日志（带 strategy_id）
    try {
      await queryRaw(
        `INSERT INTO position_log (code, timestamp, total_score, position, factor_scores, sentiment_mode, strategy_id)
         VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
        [
          code,
          stockFactors.totalScore,
          position.finalPosition,
          JSON.stringify(stockFactors.factors),
          sentimentMode,
          strategyId || null,
        ]
      );
    } catch {
      // 日志写入失败不影响主流程
    }

    return NextResponse.json({
      success: true,
      data: {
        code,
        price: currentPrice,
        sentimentScore,
        sentimentMode,
        correctionFactor,
        stockFactors,
        position,
        chanlunStage,
        waveStage,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[MultiFactor] GET error:', errorMsg, errorStack);
    return NextResponse.json(
      { success: false, error: "多因子分析失败: " + errorMsg },
      { status: 500 }
    );
  }
}

// POST: 接收数据推送（统一结构：type/status/message）
// 兼容旧格式（直接推送 sentiment 数据，无 type 字段）
export async function POST(request: NextRequest) {
  try {
    // 验证推送 Token
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.PUSH_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { success: false, error: "未授权访问" },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('[Multifactor POST] received type:', body.type, 'keys:', Object.keys(body));

    // 兼容旧格式：如果没有 type 字段，默认为 sentiment
    const type = body.type || 'sentiment';
    const status = body.status || 'available';
    const message = body.message || '';

    // 根据 type 分发到不同的处理逻辑
    // 统一兼容两种推送格式：
    //   嵌套格式: {"type":"overseas", "overseas": {...}}
    //   扁平格式: {"type":"overseas", "trade_date": "...", "sp500": ...}
    switch (type) {
      case 'sentiment':
        return await handleSentiment(body.sentiment || body, status, message);
      case 'overseas':
        return await handleOverseas(body.overseas || body, status, message);
      case 'macro_china':
        return await handleMacroChina(body.macro_china || body, status, message);
      case 'macro_us':
        return await handleMacroUs(body.macro_us || body, status, message);
      case 'rate':
        return await handleRate(body.rate || body, status, message);
      default:
        return NextResponse.json(
          { success: false, error: `未知的 type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "推送处理失败: " + errorMsg },
      { status: 500 }
    );
  }
}

// 处理情绪数据推送
async function handleSentiment(body: any, status: string, message: string) {
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

  // M2/M5 字段补齐：李富贵推送只含 M1/M3/M4，
  // 换手率与融资余额由服务端从 Tushare 自动补齐（带缓存，补齐失败则因子不参与评分）
  const needTurnover = rawData.turnover_rate === undefined || rawData.turnover_rate === null;
  const needMargin = rawData.margin_balance === undefined || rawData.margin_balance === null;
  if (needTurnover || needMargin) {
    const [tushareTurnover, tushareMargin] = await Promise.all([
      needTurnover ? getMarketTurnoverRate() : Promise.resolve(null),
      needMargin ? getMarginBalance() : Promise.resolve(null),
    ]);
    if (needTurnover && tushareTurnover !== null) {
      rawData.turnover_rate = tushareTurnover;
    }
    if (needMargin && tushareMargin !== null) {
      rawData.margin_balance = tushareMargin;
    }
  }

  // 变化率补齐：推送未携带 change_pct 时，与上一条情绪快照对比计算
  const needChangePct =
    rawData.volume_change_pct === undefined ||
    (rawData.turnover_rate !== undefined && rawData.turnover_change_pct === undefined) ||
    rawData.limit_up_change_pct === undefined ||
    rawData.limit_down_change_pct === undefined ||
    (rawData.margin_balance !== undefined && rawData.margin_change_pct === undefined);
  if (needChangePct) {
    try {
      const { rows } = await queryRaw<{
        total_volume: number | null;
        turnover_rate: number | null;
        limit_up_count: number | null;
        limit_down_count: number | null;
        margin_balance: number | null;
      }>(
        `SELECT total_volume, turnover_rate, limit_up_count, limit_down_count, margin_balance
         FROM sentiment_snapshot ORDER BY timestamp DESC LIMIT 1`
      );
      const prev = rows[0];
      if (prev) {
        const pct = (cur: number | undefined, old: number | null): number | undefined => {
          if (cur === undefined || old === null || Number(old) === 0) return undefined;
          return Math.round(((cur - Number(old)) / Math.abs(Number(old))) * 10000) / 100;
        };
        rawData.volume_change_pct ??= pct(rawData.total_volume, prev.total_volume);
        rawData.turnover_change_pct ??= pct(rawData.turnover_rate, prev.turnover_rate);
        rawData.limit_up_change_pct ??= pct(rawData.limit_up_count, prev.limit_up_count);
        rawData.limit_down_change_pct ??= pct(rawData.limit_down_count, prev.limit_down_count);
        rawData.margin_change_pct ??= pct(rawData.margin_balance, prev.margin_balance);
      }
    } catch {
      // 快照查询失败时保持 change_pct 缺失，引擎退化为纯水位分
    }
  }

  // 计算情绪评分
  const sentimentResult = calculateSentiment(rawData);

  // 保存情绪快照到数据库（包含 status 和 message）
  await queryRaw(
    `INSERT INTO sentiment_snapshot
     (timestamp, total_volume, volume_change_pct, turnover_rate, turnover_change_pct,
      limit_up_count, limit_up_change_pct, limit_down_count, limit_down_change_pct,
      margin_balance, margin_change_pct, sentiment_score, heat_level, factor_scores, raw_data,
      status, message)
     VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
      status,
      message,
    ]
  );

  return NextResponse.json({
    success: true,
    data: sentimentResult,
  });
}

// 处理海外股价推送（body 已经是 overseas 对象，由 POST handler 分发时提取）
async function handleOverseas(body: any, status: string, message: string) {
  if (!body) {
    return NextResponse.json({ success: false, error: "缺少 overseas 数据" }, { status: 400 });
  }

  console.log('[Overseas] received keys:', Object.keys(body), 'values:', JSON.stringify(body).substring(0, 500));

  // trade_date 缺失时自动用当天日期（YYYY-MM-DD）
  const trade_date = body.trade_date || body.date || new Date().toISOString().slice(0, 10);

  await queryRaw(
    `INSERT INTO overseas_prices
     (trade_date, sp500, nasdaq, nvda, aapl, tsla, amd, avgo, tsm, qcom, googl, msft, intc,
      nikkei, tel, samsung, status, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (trade_date) DO UPDATE SET
       sp500 = COALESCE(EXCLUDED.sp500, overseas_prices.sp500),
       nasdaq = COALESCE(EXCLUDED.nasdaq, overseas_prices.nasdaq),
       nvda = COALESCE(EXCLUDED.nvda, overseas_prices.nvda),
       aapl = COALESCE(EXCLUDED.aapl, overseas_prices.aapl),
       tsla = COALESCE(EXCLUDED.tsla, overseas_prices.tsla),
       amd = COALESCE(EXCLUDED.amd, overseas_prices.amd),
       avgo = COALESCE(EXCLUDED.avgo, overseas_prices.avgo),
       tsm = COALESCE(EXCLUDED.tsm, overseas_prices.tsm),
       qcom = COALESCE(EXCLUDED.qcom, overseas_prices.qcom),
       googl = COALESCE(EXCLUDED.googl, overseas_prices.googl),
       msft = COALESCE(EXCLUDED.msft, overseas_prices.msft),
       intc = COALESCE(EXCLUDED.intc, overseas_prices.intc),
       nikkei = COALESCE(EXCLUDED.nikkei, overseas_prices.nikkei),
       tel = COALESCE(EXCLUDED.tel, overseas_prices.tel),
       samsung = COALESCE(EXCLUDED.samsung, overseas_prices.samsung),
       status = EXCLUDED.status, message = EXCLUDED.message`,
    [
      trade_date,
      body.sp500 ?? null,
      body.nasdaq ?? null,
      body.nvda ?? null,
      body.aapl ?? null,
      body.tsla ?? null,
      body.amd ?? null,
      body.avgo ?? null,
      body.tsm ?? null,
      body.qcom ?? null,
      body.googl ?? null,
      body.msft ?? null,
      body.intc ?? null,
      body.nikkei ?? null,
      body.tel ?? null,
      body.samsung ?? null,
      status,
      message,
    ]
  );

  return NextResponse.json({
    success: true,
    message: "海外股价数据已保存",
    data: { trade_date, status, message, received_keys: Object.keys(body) },
  });
}

// 处理中国宏观数据推送（body 已经是 macro_china 对象）
async function handleMacroChina(body: any, status: string, message: string) {
  if (!body) {
    return NextResponse.json({ success: false, error: "缺少 macro_china 数据" }, { status: 400 });
  }

  console.log('[MacroChina] received keys:', Object.keys(body), 'values:', JSON.stringify(body).substring(0, 500));

  // 兼容多种字段命名：pmi/PMI, cpi/CPI, ppi/PPI, social_financing/社融/sf, m2_growth/M2, gdp_yoy/GDP
  const period = body.period || body.date || body.month || new Date().toISOString().slice(0, 7);
  const pmi = body.pmi ?? body.PMI ?? null;
  const cpi = body.cpi ?? body.CPI ?? null;
  const ppi = body.ppi ?? body.PPI ?? null;
  const social_financing = body.social_financing ?? body.sf ?? body.sheng_rong ?? null;
  const m2_growth = body.m2_growth ?? body.m2 ?? body.M2 ?? null;
  const gdp_yoy = body.gdp_yoy ?? body.gdp ?? body.GDP ?? null;

  await queryRaw(
    `INSERT INTO macro_china
     (period, pmi, cpi, ppi, social_financing, m2_growth, gdp_yoy, status, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (period) DO UPDATE SET
       pmi = COALESCE(EXCLUDED.pmi, macro_china.pmi),
       cpi = COALESCE(EXCLUDED.cpi, macro_china.cpi),
       ppi = COALESCE(EXCLUDED.ppi, macro_china.ppi),
       social_financing = COALESCE(EXCLUDED.social_financing, macro_china.social_financing),
       m2_growth = COALESCE(EXCLUDED.m2_growth, macro_china.m2_growth),
       gdp_yoy = COALESCE(EXCLUDED.gdp_yoy, macro_china.gdp_yoy),
       status = EXCLUDED.status, message = EXCLUDED.message`,
    [period, pmi, cpi, ppi, social_financing, m2_growth, gdp_yoy, status, message]
  );

  return NextResponse.json({
    success: true,
    message: "中国宏观数据已保存",
    data: { period, pmi, cpi, ppi, social_financing, m2_growth, gdp_yoy, status, message },
  });
}

// 处理美国宏观数据推送（body 已经是 macro_us 对象）
async function handleMacroUs(body: any, status: string, message: string) {
  if (!body) {
    return NextResponse.json({ success: false, error: "缺少 macro_us 数据" }, { status: 400 });
  }

  console.log('[MacroUs] received keys:', Object.keys(body), 'values:', JSON.stringify(body).substring(0, 500));

  // 兼容多种字段命名
  const period = body.period || body.date || body.month || new Date().toISOString().slice(0, 7);
  const cpi = body.cpi ?? body.CPI ?? null;
  const core_pce = body.core_pce ?? body.pce ?? body.corePCE ?? null;
  const nonfarm_payroll = body.nonfarm_payroll ?? body.nonfarm ?? body.nfp ?? null;
  const unemployment_rate = body.unemployment_rate ?? body.unemployment ?? body.unemploy ?? null;
  const fed_rate = body.fed_rate ?? body.fedRate ?? body.fed_funds_rate ?? null;

  await queryRaw(
    `INSERT INTO macro_us
     (period, cpi, core_pce, nonfarm_payroll, unemployment_rate, fed_rate, status, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (period) DO UPDATE SET
       cpi = COALESCE(EXCLUDED.cpi, macro_us.cpi),
       core_pce = COALESCE(EXCLUDED.core_pce, macro_us.core_pce),
       nonfarm_payroll = COALESCE(EXCLUDED.nonfarm_payroll, macro_us.nonfarm_payroll),
       unemployment_rate = COALESCE(EXCLUDED.unemployment_rate, macro_us.unemployment_rate),
       fed_rate = COALESCE(EXCLUDED.fed_rate, macro_us.fed_rate),
       status = EXCLUDED.status, message = EXCLUDED.message`,
    [period, cpi, core_pce, nonfarm_payroll, unemployment_rate, fed_rate, status, message]
  );

  return NextResponse.json({
    success: true,
    message: "美国宏观数据已保存",
    data: { period, cpi, core_pce, nonfarm_payroll, unemployment_rate, fed_rate, status, message },
  });
}

// 处理央行利率推送（body 已经是 rate 对象）
async function handleRate(body: any, status: string, message: string) {
  if (!body) {
    return NextResponse.json({ success: false, error: "缺少 rate 数据" }, { status: 400 });
  }

  console.log('[Rate] received keys:', Object.keys(body), 'values:', JSON.stringify(body).substring(0, 500));

  // 兼容多种字段命名
  const bank = body.bank || body.central_bank || body.name || null;
  const rateValue = body.rate ?? body.interest_rate ?? body.rate_value ?? null;

  if (!bank || rateValue === undefined || rateValue === null) {
    return NextResponse.json({ success: false, error: "缺少 bank 或 rate", received_keys: Object.keys(body) }, { status: 400 });
  }

  await queryRaw(
    `INSERT INTO central_bank_rates (bank, rate)
     VALUES ($1, $2)
     ON CONFLICT (bank) DO UPDATE SET rate = EXCLUDED.rate, updated_at = NOW()`,
    [bank, rateValue]
  );

  return NextResponse.json({
    success: true,
    message: "央行利率数据已保存",
    data: { bank, rate: rateValue },
  });
}
