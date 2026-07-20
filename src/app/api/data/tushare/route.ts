import { NextRequest, NextResponse } from "next/server";

/**
 * Tushare Pro API 代理路由
 * 
 * 功能：
 * - 代理前端请求到 Tushare Pro API
 * - Token 只存在服务端，前端无法接触
 * - 支持日线/周线/月线数据
 * - 自动转换股票代码格式（000001 → 000001.SZ）
 * 
 * 请求参数：
 * - code: 股票代码（如 000001, 600519）
 * - period: 周期（daily/weekly/monthly）
 * - start_date: 开始日期（可选，格式 YYYYMMDD）
 * - end_date: 结束日期（可选，格式 YYYYMMDD）
 * - api_name: Tushare API名称（可选，默认 daily）
 */

const TUSHARE_API_URL = "http://api.tushare.pro";

// Tushare Token 从环境变量读取，绝不暴露给前端
const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN || "";

// 周期映射：系统内部格式 → Tushare API参数
const PERIOD_MAP: Record<string, string> = {
  daily: "daily",
  weekly: "weekly", 
  monthly: "monthly",
};

// Tushare API 名称映射
const API_NAME_MAP: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  stk_factor: "stk_factor",
};

/**
 * 将系统内部股票代码转换为 Tushare 格式
 * 000001 → 000001.SZ（深市）
 * 600519 → 600519.SH（沪市）
 * 300xxx → 300xxx.SZ（创业板）
 * 688xxx → 688xxx.SH（科创板）
 */
function convertToTushareCode(code: string): string {
  const cleanCode = code.replace(/[^0-9]/g, "");
  
  if (cleanCode.startsWith("6")) {
    // 沪市：6开头
    return `${cleanCode}.SH`;
  } else if (cleanCode.startsWith("0") || cleanCode.startsWith("3")) {
    // 深市/创业板：0或3开头
    return `${cleanCode}.SZ`;
  } else if (cleanCode.startsWith("8") || cleanCode.startsWith("4")) {
    // 北交所：8或4开头
    return `${cleanCode}.BJ`;
  }
  
  // 默认当作深市
  return `${cleanCode}.SZ`;
}

/**
 * 将 Tushare 返回的数据转换为系统统一格式
 */
function transformKLineData(tushareData: string[][]): Array<{
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}> {
  if (!tushareData || !Array.isArray(tushareData)) {
    return [];
  }

  return tushareData.map((row) => ({
    date: row[0] || "", // trade_date
    open: parseFloat(row[1]) || 0,
    high: parseFloat(row[2]) || 0,
    low: parseFloat(row[3]) || 0,
    close: parseFloat(row[4]) || 0,
    volume: parseFloat(row[5]) || 0, // vol (手)
    amount: parseFloat(row[6]) || 0, // amount (千元)
  }));
}

/**
 * 调用 Tushare Pro API
 */
async function callTushareAPI(
  apiName: string,
  params: Record<string, string>,
  fields?: string
): Promise<{ code: number; data: { items: string[][] } | null; message: string }> {
  if (!TUSHARE_TOKEN) {
    return {
      code: -1,
      data: null,
      message: "TUSHARE_TOKEN 未配置",
    };
  }

  const requestBody = {
    api_name: apiName,
    token: TUSHARE_TOKEN,
    params: params,
    fields: fields || "",
  };

  try {
    const response = await fetch(TUSHARE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!response.ok) {
      return {
        code: response.status,
        data: null,
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json();
    
    // Tushare 返回格式: { code: 0, data: { items: [...], fields: [...] }, message: "" }
    if (result.code !== 0) {
      return {
        code: result.code || -1,
        data: null,
        message: result.message || "Tushare API 返回错误",
      };
    }

    return {
      code: 0,
      data: result.data,
      message: "",
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      code: -1,
      data: null,
      message: `请求失败: ${errMsg}`,
    };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const period = searchParams.get("period") || "daily";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const apiName = searchParams.get("api_name") || "daily";

  if (!code) {
    return NextResponse.json(
      { success: false, error: "缺少股票代码参数" },
      { status: 400 }
    );
  }

  if (!TUSHARE_TOKEN) {
    return NextResponse.json(
      { success: false, error: "TUSHARE_TOKEN 未配置，请在环境变量中设置" },
      { status: 500 }
    );
  }

  // 转换股票代码
  const tsCode = convertToTushareCode(code);
  
  // 确定 API 名称
  const actualApiName = API_NAME_MAP[apiName] || API_NAME_MAP[period] || "daily";

  // 构建请求参数
  const params: Record<string, string> = {
    ts_code: tsCode,
  };

  if (startDate) {
    params.start_date = startDate.replace(/-/g, "");
  }
  if (endDate) {
    params.end_date = endDate.replace(/-/g, "");
  }

  // 确定返回字段
  let fields = "trade_date,open,high,low,close,vol,amount";
  if (apiName === "stk_factor") {
    fields = "ts_code,trade_date,close,turnover_rate,turnover_rate_f,volume_ratio,pe,pe_ttm,pb,ps,ps_ttm,dv_ratio,dv_ttm,total_share,float_share,free_share,total_mv,circ_mv";
  }

  // 调用 Tushare API
  const result = await callTushareAPI(actualApiName, params, fields);

  if (result.code !== 0 || !result.data) {
    return NextResponse.json(
      { 
        success: false, 
        error: result.message,
        source: "tushare",
        code: tsCode,
      },
      { status: 500 }
    );
  }

  // 转换数据格式
  const klineData = transformKLineData(result.data.items || []);

  return NextResponse.json({
    success: true,
    data: klineData,
    source: "tushare",
    code: tsCode,
    period: period,
    count: klineData.length,
  });
}

// 也支持 POST 请求（用于批量查询）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { codes, period, start_date, end_date, api_name } = body;

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { success: false, error: "缺少股票代码列表" },
        { status: 400 }
      );
    }

    if (!TUSHARE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "TUSHARE_TOKEN 未配置" },
        { status: 500 }
      );
    }

    const results: Record<string, { success: boolean; data?: unknown; error?: string }> = {};

    // 批量查询（串行，避免并发过多）
    for (const code of codes) {
      const tsCode = convertToTushareCode(code);
      const actualApiName = API_NAME_MAP[api_name] || API_NAME_MAP[period] || "daily";
      
      const params: Record<string, string> = { ts_code: tsCode };
      if (start_date) params.start_date = start_date.replace(/-/g, "");
      if (end_date) params.end_date = end_date.replace(/-/g, "");

      const result = await callTushareAPI(actualApiName, params);
      
      if (result.code === 0 && result.data) {
        results[code] = {
          success: true,
          data: transformKLineData(result.data.items || []),
        };
      } else {
        results[code] = {
          success: false,
          error: result.message,
        };
      }
    }

    return NextResponse.json({
      success: true,
      results,
      source: "tushare",
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
