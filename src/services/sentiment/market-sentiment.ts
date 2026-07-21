// 大盘情绪指数算法 - 8个指标加权评分

import type { MarketData, MarketSentimentResult, SentimentDetail, MarketLevel } from './types';

// 涨跌家数比（权重20%）
function calcUpDownRatio(data: MarketData): SentimentDetail {
  const total = data.upCount + data.downCount;
  const ratio = total > 0 ? data.upCount / total : 0.5;
  const score = Math.min(100, Math.max(0, ratio * 100));
  const value = `${data.upCount}/${data.downCount} (${(ratio * 100).toFixed(1)}%)`;
  
  return {
    name: '涨跌家数比',
    score: Math.round(score),
    weight: 20,
    value,
    description: '反映市场整体涨跌力量对比，上涨家数占比越高市场情绪越乐观',
    calculation: `上涨家数(${data.upCount}) / (上涨${data.upCount} + 下跌${data.downCount}) = ${(ratio * 100).toFixed(2)}%`,
    impact: score > 70 ? '多头占优，市场情绪偏暖' : score > 40 ? '多空均衡，方向不明' : '空头占优，市场情绪偏冷',
  };
}

// 涨停跌停比（权重15%）
function calcLimitUpDownRatio(data: MarketData): SentimentDetail {
  const total = data.limitUpCount + data.limitDownCount;
  const ratio = total > 0 ? data.limitUpCount / total : 0.5;
  const score = Math.min(100, Math.max(0, ratio * 100));
  const value = `涨停${data.limitUpCount}/跌停${data.limitDownCount}`;
  
  return {
    name: '涨停跌停比',
    score: Math.round(score),
    weight: 15,
    value,
    description: '涨停跌停数量对比，反映极端情绪强度。涨停多说明市场做多热情高涨',
    calculation: `涨停${data.limitUpCount} / (涨停${data.limitUpCount} + 跌停${data.limitDownCount}) = ${(ratio * 100).toFixed(1)}%`,
    impact: score > 80 ? '赚钱效应极强，市场亢奋' : score > 50 ? '赚钱效应尚可' : '亏钱效应明显，市场恐慌',
  };
}

// 成交额偏离度（权重15%）
function calcVolumeDeviation(data: MarketData): SentimentDetail {
  const deviation = data.avgVolume20 > 0 ? data.todayVolume / data.avgVolume20 : 1;
  let score: number;
  
  if (deviation >= 1.5) {
    score = 100;
  } else if (deviation >= 1.2) {
    score = 70 + (deviation - 1.2) * 100;
  } else if (deviation >= 0.8) {
    score = 40 + (deviation - 0.8) * 75;
  } else if (deviation >= 0.5) {
    score = 10 + (deviation - 0.5) * 100;
  } else {
    score = 0;
  }
  
  score = Math.min(100, Math.max(0, score));
  const value = `${deviation.toFixed(2)}倍 (${(data.todayVolume / 100000000).toFixed(0)}亿/20日均额)`;
  
  return {
    name: '成交额偏离度',
    score: Math.round(score),
    weight: 15,
    value,
    description: '今日成交额与20日均额的比值，反映市场活跃度和资金参与热情',
    calculation: `今日成交${(data.todayVolume / 100000000).toFixed(0)}亿 / 20日均额${(data.avgVolume20 / 100000000).toFixed(0)}亿 = ${deviation.toFixed(2)}倍`,
    impact: score > 70 ? '资金大幅流入，市场极度活跃' : score > 40 ? '成交正常，市场平稳' : '成交萎缩，市场观望情绪浓',
  };
}

// 连板高度（权重10%）
function calcMaxBoardDays(data: MarketData): SentimentDetail {
  const score = Math.min(100, data.maxBoardDays * 15);
  const value = `${data.maxBoardDays}连板`;
  
  return {
    name: '连板高度',
    score: Math.round(score),
    weight: 10,
    value,
    description: '市场最高连板天数，反映短线资金的风险偏好和赚钱效应',
    calculation: `最高连板${data.maxBoardDays}天 × 15 = ${Math.min(100, data.maxBoardDays * 15)}分`,
    impact: score > 70 ? '短线情绪高涨，游资活跃' : score > 40 ? '短线情绪一般' : '短线情绪低迷，连板断层',
  };
}

// 封板成功率（权重10%）
function calcBoardSuccessRate(data: MarketData): SentimentDetail {
  const successRate = 100 - data.brokenBoardRate;
  const score = Math.min(100, Math.max(0, successRate));
  const value = `封板率${successRate.toFixed(1)}% (炸板率${data.brokenBoardRate.toFixed(1)}%)`;
  
  return {
    name: '封板成功率',
    score: Math.round(score),
    weight: 10,
    value,
    description: '涨停封板成功率，100%减去炸板率。封板率高说明做多资金坚定',
    calculation: `100% - 炸板率${data.brokenBoardRate.toFixed(1)}% = ${successRate.toFixed(1)}%`,
    impact: score > 80 ? '封板坚决，做多意愿强' : score > 60 ? '封板尚可，有一定分歧' : '炸板频繁，多空分歧大',
  };
}

// 北向资金（权重10%）
function calcNorthFlow(data: MarketData): SentimentDetail {
  let score: number;
  
  if (data.northNetFlow >= 100) {
    score = 100;
  } else if (data.northNetFlow >= 50) {
    score = 70 + (data.northNetFlow - 50) * 0.6;
  } else if (data.northNetFlow >= 0) {
    score = 50 + data.northNetFlow * 0.4;
  } else if (data.northNetFlow >= -50) {
    score = 25 + (data.northNetFlow + 50) * 0.5;
  } else {
    score = Math.max(0, 25 + (data.northNetFlow + 50) * 0.5);
  }
  
  score = Math.min(100, Math.max(0, score));
  const value = `净流入${data.northNetFlow.toFixed(1)}亿`;
  
  return {
    name: '北向资金',
    score: Math.round(score),
    weight: 10,
    value,
    description: '北向资金（外资）净流入情况，反映外资对A股的态度',
    calculation: `净流入${data.northNetFlow.toFixed(1)}亿 ${data.northNetFlow >= 100 ? '≥100亿满分' : data.northNetFlow <= -50 ? '≤-50亿0分' : '线性插值'}`,
    impact: score > 70 ? '外资大幅流入，看好后市' : score > 40 ? '外资态度中性' : '外资流出，谨慎观望',
  };
}

// 两融余额变化（权重10%）
function calcMarginChange(data: MarketData): SentimentDetail {
  const change = data.marginChange5d;
  let score: number;
  
  if (change >= 2) {
    score = 100;
  } else if (change >= 0) {
    score = 50 + change * 25;
  } else if (change >= -2) {
    score = 50 + change * 25;
  } else {
    score = Math.max(0, 50 + change * 25);
  }
  
  score = Math.min(100, Math.max(0, score));
  const value = `5日变化${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  
  return {
    name: '两融余额变化',
    score: Math.round(score),
    weight: 10,
    value,
    description: '近5日融资融券余额变化率，反映杠杆资金的加减仓意愿',
    calculation: `5日变化率${change >= 0 ? '+' : ''}${change.toFixed(2)}% ${change >= 2 ? '≥2%满分' : change <= -2 ? '≤-2%0分' : '线性插值'}`,
    impact: score > 70 ? '杠杆资金积极加仓' : score > 40 ? '杠杆资金态度中性' : '杠杆资金减仓离场',
  };
}

// 新高新低差（权重10%）
function calcHighLowDiff(data: MarketData): SentimentDetail {
  const diff = (data.newHighCount - data.newLowCount) / Math.max(1, data.totalStocks) * 100 + 50;
  const score = Math.min(100, Math.max(0, diff));
  const value = `新高${data.newHighCount}/新低${data.newLowCount}`;
  
  return {
    name: '新高新低差',
    score: Math.round(score),
    weight: 10,
    value,
    description: '创52周新高与新低的股票数量差，反映市场中长期趋势强度',
    calculation: `(新高${data.newHighCount} - 新低${data.newLowCount}) / 总数${data.totalStocks} × 100 + 50 = ${diff.toFixed(1)}`,
    impact: score > 70 ? '强势股增多，上升趋势良好' : score > 40 ? '强弱均衡' : '弱势股增多，下降趋势',
  };
}

// 计算综合等级
function getLevel(score: number): MarketLevel {
  if (score < 20) return '极度恐慌';
  if (score < 40) return '恐慌';
  if (score < 60) return '中性';
  if (score < 80) return '贪婪';
  return '极度贪婪';
}

// 主函数：计算大盘情绪
export function calculateMarketSentiment(data: MarketData): MarketSentimentResult {
  const details: SentimentDetail[] = [
    calcUpDownRatio(data),
    calcLimitUpDownRatio(data),
    calcVolumeDeviation(data),
    calcMaxBoardDays(data),
    calcBoardSuccessRate(data),
    calcNorthFlow(data),
    calcMarginChange(data),
    calcHighLowDiff(data),
  ];
  
  // 加权计算总分
  const totalWeight = details.reduce((sum, d) => sum + d.weight, 0);
  const score = Math.round(
    details.reduce((sum, d) => sum + d.score * (d.weight / totalWeight), 0)
  );
  
  return {
    score,
    level: getLevel(score),
    details,
  };
}

// 数据获取 - 无真实数据源时返回null，前端显示"暂无数据"
export function fetchMarketSentiment(): null {
  // 大盘情绪需要真实行情数据（涨跌家数、涨停跌停、成交额、北向资金等）
  // 当前无独立API数据源，返回null由前端显示"暂无数据"
  return null;
}
