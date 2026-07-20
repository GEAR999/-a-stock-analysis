// 财务基本面数据获取与解析

export interface FinancialData {
  code: string;
  name: string;
  // 核心估值指标
  pe: number | null;          // 市盈率
  pb: number | null;          // 市净率
  roe: number | null;         // 净资产收益率(%)
  // 盈利能力
  grossMargin: number | null; // 毛利率(%)
  netMargin: number | null;   // 净利率(%)
  // 成长性
  revenueGrowth: number | null;    // 营收增长率(%)
  profitGrowth: number | null;     // 净利润增长率(%)
  // 安全性
  debtRatio: number | null;   // 资产负债率(%)
  // 综合评级
  grade: 'A' | 'B' | 'C' | 'D' | null;
  gradeDesc: string;
  // 报告期
  reportDate: string;
}

// 从东方财富API解析财务数据
export function parseFinancialResponse(rawData: unknown): FinancialData | null {
  if (!rawData || typeof rawData !== 'object') return null;

  const data = rawData as Record<string, unknown>;
  const resultObj = data?.result as Record<string, unknown> | undefined;
  const result = resultObj?.data as Array<Record<string, unknown>> | undefined;

  if (!Array.isArray(result) || result.length === 0) return null;

  const item = result[0];

  const pe = toNumber(item.BASIC_EPS);
  const pb = toNumber(item.BASIC_BPS);
  const roe = toNumber(item.WEIGHTAVG_ROE);
  const grossMargin = toNumber(item.XSMLL);
  const netMargin = toNumber(item.XSJLL);
  const revenueGrowth = toNumber(item.YYSRLTBZ);
  const profitGrowth = toNumber(item.PARENTNETPROFIT_YOY);
  const debtRatio = toNumber(item.ZCFZL);
  const reportDate = String(item.REPORT_DATE || '').slice(0, 10);

  // 计算综合评级
  const { grade, gradeDesc } = calculateGrade({ pe, pb, roe, grossMargin, netMargin, revenueGrowth, profitGrowth, debtRatio });

  return {
    code: String(item.SECURITY_CODE || ''),
    name: String(item.SECURITY_NAME_ABBR || ''),
    pe,
    pb,
    roe,
    grossMargin,
    netMargin,
    revenueGrowth,
    profitGrowth,
    debtRatio,
    grade,
    gradeDesc,
    reportDate,
  };
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return null;
  return num;
}

// 计算综合评级
function calculateGrade(data: {
  pe: number | null;
  pb: number | null;
  roe: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  profitGrowth: number | null;
  debtRatio: number | null;
}): { grade: FinancialData['grade']; gradeDesc: string } {
  let score = 0;
  let factors = 0;

  // PE评分（越低越好，但负值扣分）
  if (data.pe !== null) {
    factors++;
    if (data.pe > 0 && data.pe < 15) score += 20;
    else if (data.pe >= 15 && data.pe < 30) score += 15;
    else if (data.pe >= 30 && data.pe < 60) score += 8;
    else if (data.pe >= 60) score += 3;
    else score += 0; // 负PE
  }

  // ROE评分（越高越好）
  if (data.roe !== null) {
    factors++;
    if (data.roe >= 20) score += 25;
    else if (data.roe >= 15) score += 20;
    else if (data.roe >= 10) score += 15;
    else if (data.roe >= 5) score += 8;
    else score += 3;
  }

  // 毛利率评分
  if (data.grossMargin !== null) {
    factors++;
    if (data.grossMargin >= 50) score += 20;
    else if (data.grossMargin >= 30) score += 15;
    else if (data.grossMargin >= 15) score += 10;
    else score += 5;
  }

  // 营收增长率评分
  if (data.revenueGrowth !== null) {
    factors++;
    if (data.revenueGrowth >= 30) score += 20;
    else if (data.revenueGrowth >= 15) score += 15;
    else if (data.revenueGrowth >= 5) score += 10;
    else if (data.revenueGrowth >= 0) score += 5;
    else score += 0;
  }

  // 资产负债率评分（越低越好，但太低也不好）
  if (data.debtRatio !== null) {
    factors++;
    if (data.debtRatio < 30) score += 15;
    else if (data.debtRatio < 50) score += 20;
    else if (data.debtRatio < 70) score += 12;
    else score += 5; // 高负债
  }

  // 归一化到100分
  const maxPossible = factors * 25;
  const normalizedScore = maxPossible > 0 ? (score / maxPossible) * 100 : 50;

  let grade: FinancialData['grade'];
  let gradeDesc: string;

  if (normalizedScore >= 80) {
    grade = 'A';
    gradeDesc = '基本面优秀，各项指标表现突出';
  } else if (normalizedScore >= 60) {
    grade = 'B';
    gradeDesc = '基本面良好，整体表现稳健';
  } else if (normalizedScore >= 40) {
    grade = 'C';
    gradeDesc = '基本面一般，部分指标需关注';
  } else {
    grade = 'D';
    gradeDesc = '基本面较弱，存在一定风险';
  }

  return { grade, gradeDesc };
}

// 格式化百分比
export function formatPercent(val: number | null, suffix = '%'): string {
  if (val === null) return '--';
  return `${val.toFixed(2)}${suffix}`;
}

// 格式化PE/PB
export function formatRatio(val: number | null): string {
  if (val === null) return '--';
  return val.toFixed(2);
}
