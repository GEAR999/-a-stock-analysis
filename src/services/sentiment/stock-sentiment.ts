// 个股情绪算法 - 7个指标加权评分 + 自动标签

import type { StockData, StockSentimentResult, SentimentDetail } from './types';

// 量比（15%）
function calcVolumeRatio(data: StockData): SentimentDetail {
  const ratio = data.avgVolume5 > 0 ? data.todayVolume / data.avgVolume5 : 1;
  let score: number;
  
  if (ratio >= 5) {
    score = 100; // 异常放量
  } else if (ratio >= 3) {
    score = 85 + (ratio - 3) * 7.5; // 3-5倍 85-100
  } else if (ratio >= 1.5) {
    score = 70 + (ratio - 1.5) * 10; // 1.5-3倍 70-85
  } else if (ratio >= 0.7) {
    score = 40 + (ratio - 0.7) * 37.5; // 0.7-1.5倍 40-70
  } else {
    score = Math.max(0, 20 + (ratio - 0.5) * 100); // <0.7 缩量
  }
  
  score = Math.min(100, Math.max(0, score));
  const value = `${ratio.toFixed(2)}倍`;
  
  return {
    name: '量比',
    score: Math.round(score),
    weight: 15,
    value,
    description: '今日成交量与5日均量的比值，反映当日交易活跃度',
    calculation: `今日成交${data.todayVolume} / 5日均量${data.avgVolume5} = ${ratio.toFixed(2)}倍`,
    impact: score > 85 ? '异常放量，可能有重大消息' : score > 70 ? '温和放量，资金关注' : score > 40 ? '量能正常' : '明显缩量，关注度低',
  };
}

// 换手率分位（15%）
function calcTurnoverPercentile(data: StockData): SentimentDetail {
  const history = data.turnoverHistory60.length > 0 ? data.turnoverHistory60 : [data.turnoverRate];
  const sorted = [...history].sort((a, b) => a - b);
  const rank = sorted.findIndex(v => v >= data.turnoverRate);
  const percentile = rank >= 0 ? (rank / sorted.length) * 100 : 100;
  const score = Math.min(100, Math.max(0, percentile));
  const value = `换手${data.turnoverRate.toFixed(2)}% (近60日${percentile.toFixed(0)}%分位)`;
  
  return {
    name: '换手率分位',
    score: Math.round(score),
    weight: 15,
    value,
    description: '当前换手率在近60日中的百分位位置，反映当前活跃度相对历史的位置',
    calculation: `当前换手${data.turnoverRate.toFixed(2)}%在近60日中排第${rank + 1}位，百分位${percentile.toFixed(1)}%`,
    impact: score > 80 ? '极度活跃，处于历史高位' : score > 50 ? '活跃度中等偏上' : score > 20 ? '活跃度偏低' : '极度冷清',
  };
}

// 大单净流入（20%）
function calcBigOrderInflow(data: StockData): SentimentDetail {
  const ratio = data.marketCap > 0 ? (data.bigOrderNetInflow / data.marketCap) * 10000 : 0;
  let score: number;
  
  if (ratio >= 30) {
    score = 100;
  } else if (ratio >= 10) {
    score = 70 + (ratio - 10) * 1;
  } else if (ratio >= 0) {
    score = 50 + ratio * 2;
  } else if (ratio >= -20) {
    score = 30 + (ratio + 20) * 1;
  } else {
    score = Math.max(0, 30 + (ratio + 20) * 1.5);
  }
  
  score = Math.min(100, Math.max(0, score));
  const value = `净流入${(data.bigOrderNetInflow / 100000000).toFixed(2)}亿 (占比${ratio.toFixed(2)}‱)`;
  
  return {
    name: '大单净流入',
    score: Math.round(score),
    weight: 20,
    value,
    description: '主力大单净流入额占流通市值的比例，反映主力资金的买卖态度',
    calculation: `大单净流入${(data.bigOrderNetInflow / 100000000).toFixed(2)}亿 / 流通市值${(data.marketCap / 100000000).toFixed(0)}亿 × 10000 = ${ratio.toFixed(2)}‱`,
    impact: score > 70 ? '主力大幅买入，看好后市' : score > 40 ? '主力态度中性' : '主力卖出，看淡后市',
  };
}

// 分时强度（15%）
function calcIntradayStrength(data: StockData): SentimentDetail {
  const score = Math.min(100, Math.max(0, data.aboveAvgPriceRatio * 100));
  const value = `均价线上方${(data.aboveAvgPriceRatio * 100).toFixed(1)}%时间`;
  
  return {
    name: '分时强度',
    score: Math.round(score),
    weight: 15,
    value,
    description: '股价在分时均价线上方运行的时间占比，反映日内多头力量',
    calculation: `均价线上方时间占比 = ${(data.aboveAvgPriceRatio * 100).toFixed(1)}%`,
    impact: score > 70 ? '日内多头强势，买盘积极' : score > 40 ? '日内多空均衡' : '日内空头主导，卖压重',
  };
}

// 封板/涨幅强度（15%）
function calcLimitUpStrength(data: StockData): SentimentDetail {
  let score: number;
  let calcStr: string;
  
  if (data.isLimitUp) {
    const sealRatio = data.floatShares > 0 ? (data.bidVolume / data.floatShares) * 10000 : 0;
    score = Math.min(100, 60 + sealRatio * 2);
    calcStr = `涨停封单${data.bidVolume} / 流通盘${data.floatShares} × 10000 = ${sealRatio.toFixed(2)}‱，基础60分+`;
  } else {
    score = Math.min(100, Math.max(0, (data.changePercent + 10) / 20 * 100));
    calcStr = `(涨幅${data.changePercent.toFixed(2)}% + 10) / 20 × 100 = ${score.toFixed(0)}分`;
  }
  
  const value = data.isLimitUp 
    ? `涨停封单${(data.bidVolume / 10000).toFixed(0)}万` 
    : `涨幅${data.changePercent.toFixed(2)}%`;
  
  return {
    name: '封板/涨幅强度',
    score: Math.round(score),
    weight: 15,
    value,
    description: data.isLimitUp ? '涨停封单占流通盘比例，反映封板力度' : '当日涨幅强度，涨幅越大得分越高',
    calculation: calcStr,
    impact: score > 80 ? '封板坚决/涨幅强势' : score > 50 ? '表现中等' : '表现疲软',
  };
}

// 龙虎榜（10%）
function calcDragonTiger(data: StockData): SentimentDetail {
  let score: number;
  let typeName: string;
  
  if (!data.hasDragonTiger) {
    score = 50;
    typeName = '未上榜';
  } else if (data.dragonTigerType === '机构买入') {
    score = 90;
    typeName = '机构买入';
  } else if (data.dragonTigerType === '机构卖出') {
    score = 10;
    typeName = '机构卖出';
  } else if (data.dragonTigerType === '游资') {
    score = 60;
    typeName = '游资操作';
  } else {
    score = 50;
    typeName = data.dragonTigerType;
  }
  
  const value = typeName;
  
  return {
    name: '龙虎榜',
    score,
    weight: 10,
    value,
    description: '龙虎榜上榜情况及类型，机构买入为利好，机构卖出为利空',
    calculation: data.hasDragonTiger 
      ? `上榜类型：${typeName}，对应得分${score}分` 
      : '未上龙虎榜，默认50分',
    impact: score > 80 ? '机构看好，重大利好' : score > 50 ? '影响中性' : '机构看空，注意风险',
  };
}

// 融资变化（10%）
function calcMarginChange(data: StockData): SentimentDetail {
  const change = data.marginChange5d;
  let score: number;
  
  if (change >= 5) {
    score = 100;
  } else if (change >= 0) {
    score = 50 + change * 10;
  } else if (change >= -5) {
    score = 50 + change * 10;
  } else {
    score = Math.max(0, 50 + change * 10);
  }
  
  score = Math.min(100, Math.max(0, score));
  const value = `5日融资变化${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  
  return {
    name: '融资变化',
    score: Math.round(score),
    weight: 10,
    value,
    description: '近5日融资余额变化率，反映杠杆资金对该股的态度',
    calculation: `5日融资变化率${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
    impact: score > 70 ? '融资客积极加仓' : score > 40 ? '融资客态度中性' : '融资客减仓离场',
  };
}

// 自动生成标签
function generateTags(data: StockData, details: SentimentDetail[]): string[] {
  const tags: string[] = [];
  const volumeRatio = data.avgVolume5 > 0 ? data.todayVolume / data.avgVolume5 : 1;
  const avgScore = details.reduce((sum, d) => sum + d.score, 0) / details.length;
  
  // 极度活跃
  if (volumeRatio > 3 || data.turnoverRate > 15) {
    tags.push('极度活跃');
  }
  
  // 温和放量
  if (volumeRatio >= 1.5 && volumeRatio <= 3 && data.changePercent > 0) {
    tags.push('温和放量');
  }
  
  // 缩量回调
  if (volumeRatio < 0.7 && data.changePercent < -2) {
    tags.push('缩量回调');
  }
  
  // 恐慌杀跌
  if (data.changePercent < -7 || (data.changePercent < -5 && volumeRatio > 2)) {
    tags.push('恐慌杀跌');
  }
  
  // 主力吸筹
  const bigOrderDetail = details.find(d => d.name === '大单净流入');
  if (bigOrderDetail && bigOrderDetail.score > 70 && data.changePercent > -2) {
    tags.push('主力吸筹');
  }
  
  // 主力出货
  if (bigOrderDetail && bigOrderDetail.score < 30 && data.changePercent > 3) {
    tags.push('主力出货');
  }
  
  // 如果没有任何标签，根据综合得分添加
  if (tags.length === 0) {
    if (avgScore > 70) {
      tags.push('情绪积极');
    } else if (avgScore < 30) {
      tags.push('情绪低迷');
    } else {
      tags.push('情绪平稳');
    }
  }
  
  return tags;
}

// 主函数：计算个股情绪
export function calculateStockSentiment(data: StockData): StockSentimentResult {
  const details: SentimentDetail[] = [
    calcVolumeRatio(data),
    calcTurnoverPercentile(data),
    calcBigOrderInflow(data),
    calcIntradayStrength(data),
    calcLimitUpStrength(data),
    calcDragonTiger(data),
    calcMarginChange(data),
  ];
  
  // 加权计算总分
  const totalWeight = details.reduce((sum, d) => sum + d.weight, 0);
  const score = Math.round(
    details.reduce((sum, d) => sum + d.score * (d.weight / totalWeight), 0)
  );
  
  // 生成标签
  const tags = generateTags(data, details);
  
  return {
    score,
    tags,
    details,
  };
}

// 数据获取 - 无真实数据源时返回null，前端显示"暂无数据"
export function fetchStockSentiment(_stockCode?: string): null {
  // 个股情绪需要真实个股数据（量比、大单净流入、分时强度、龙虎榜等）
  // 当前无独立API数据源，返回null由前端显示"暂无数据"
  return null;
}
