/**
 * 数据质量校验模块
 * 第31轮第4批需求
 * 
 * 校验数据新鲜度、价格连续性、成交量有效性、多源一致性
 */

import { ValidationResult, DataSourceName } from './types';

// ============ 配置 ============

const PRICE_ANOMALY_THRESHOLD = parseFloat(process.env.PRICE_ANOMALY_THRESHOLD || '0.05');

// ============ 工具函数 ============

function isTradingHours(): boolean {
  const now = new Date();
  const bjTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = bjTime.getUTCDay();
  if (day === 0 || day === 6) return false;
  const t = bjTime.getUTCHours() * 60 + bjTime.getUTCMinutes();
  return (t >= 555 && t <= 690) || (t >= 780 && t <= 900);
}

// ============ 数据新鲜度检查 ============

export function checkDataFreshness(
  dataTimestamp: string | number | null,
  maxAgeSeconds: number = 60
): ValidationResult {
  if (!dataTimestamp) {
    return { valid: false, level: 'error', message: '无时间戳数据' };
  }

  const dataTime = typeof dataTimestamp === 'number'
    ? dataTimestamp
    : new Date(dataTimestamp).getTime();

  if (isNaN(dataTime)) {
    return { valid: false, level: 'error', message: '无效时间戳' };
  }

  const now = Date.now();
  const ageSeconds = (now - dataTime) / 1000;
  const trading = isTradingHours();

  // 交易时间超过60秒，非交易时间超过1天
  const threshold = trading ? maxAgeSeconds : 86400;

  if (ageSeconds > threshold) {
    return {
      valid: false,
      level: trading ? 'warning' : 'ok', // 非交易时间数据旧是正常的
      message: `数据已过期 ${(ageSeconds / 60).toFixed(1)} 分钟`,
      details: { ageSeconds, threshold, trading },
    };
  }

  return {
    valid: true,
    level: 'ok',
    message: `数据新鲜 (${ageSeconds.toFixed(0)}s)`,
    details: { ageSeconds },
  };
}

// ============ 价格连续性检查 ============

export function checkPriceContinuity(
  oldPrice: number,
  newPrice: number,
  threshold: number = PRICE_ANOMALY_THRESHOLD
): ValidationResult {
  if (oldPrice <= 0 || newPrice <= 0) {
    return { valid: false, level: 'error', message: '无效价格', details: { oldPrice, newPrice } };
  }

  const change = Math.abs(newPrice - oldPrice) / oldPrice;

  if (change > threshold) {
    return {
      valid: false,
      level: 'error',
      message: `价格跳变 ${(change * 100).toFixed(2)}% (${oldPrice} → ${newPrice})`,
      details: { oldPrice, newPrice, change, threshold },
    };
  }

  return {
    valid: true,
    level: 'ok',
    message: `价格连续 (变化 ${(change * 100).toFixed(2)}%)`,
    details: { oldPrice, newPrice, change },
  };
}

// ============ 成交量有效性检查 ============

export function checkVolumeValidity(
  volume: number,
  isTrading: boolean = isTradingHours()
): ValidationResult {
  if (volume < 0) {
    return { valid: false, level: 'error', message: '成交量为负数', details: { volume } };
  }

  if (volume === 0 && isTrading) {
    return {
      valid: false,
      level: 'warning',
      message: '交易时间成交量为0',
      details: { volume, isTrading },
    };
  }

  return {
    valid: true,
    level: 'ok',
    message: `成交量正常 (${volume.toLocaleString()})`,
    details: { volume },
  };
}

// ============ 多源数据一致性检查 ============

export function checkCrossSourceConsistency(
  sourceA: { price: number; source: DataSourceName },
  sourceB: { price: number; source: DataSourceName },
  threshold: number = 0.005
): ValidationResult {
  if (sourceA.price <= 0 || sourceB.price <= 0) {
    return { valid: false, level: 'error', message: '无效价格数据' };
  }

  const diff = Math.abs(sourceA.price - sourceB.price) / Math.max(sourceA.price, sourceB.price);

  if (diff > threshold) {
    // 可信度排序：tushare > mootdx > eastmoney
    const trust: Record<DataSourceName, number> = { tushare: 3, mootdx: 2, eastmoney: 1 };
    const trusted = trust[sourceA.source] >= trust[sourceB.source] ? sourceA.source : sourceB.source;

    return {
      valid: false,
      level: 'warning',
      message: `${sourceA.source} vs ${sourceB.source} 价格差异 ${(diff * 100).toFixed(2)}%`,
      details: {
        sourceA: { source: sourceA.source, price: sourceA.price },
        sourceB: { source: sourceB.source, price: sourceB.price },
        diff,
        trustedSource: trusted,
      },
    };
  }

  return {
    valid: true,
    level: 'ok',
    message: `数据源一致 (差异 ${(diff * 100).toFixed(3)}%)`,
    details: { diff },
  };
}

// ============ 综合校验 ============

export interface QualityReport {
  overall: 'ok' | 'warning' | 'error';
  checks: Array<{
    name: string;
    result: ValidationResult;
  }>;
}

export function runQualityChecks(data: {
  timestamp?: string | number;
  price?: number;
  prevPrice?: number;
  volume?: number;
  altSource?: { price: number; source: DataSourceName };
  currentSource?: DataSourceName;
}): QualityReport {
  const checks: QualityReport['checks'] = [];

  // 新鲜度
  if (data.timestamp !== undefined) {
    checks.push({ name: 'freshness', result: checkDataFreshness(data.timestamp) });
  }

  // 价格连续性
  if (data.price !== undefined && data.prevPrice !== undefined) {
    checks.push({
      name: 'continuity',
      result: checkPriceContinuity(data.prevPrice, data.price),
    });
  }

  // 成交量
  if (data.volume !== undefined) {
    checks.push({ name: 'volume', result: checkVolumeValidity(data.volume) });
  }

  // 多源一致性
  if (data.price !== undefined && data.altSource && data.currentSource) {
    checks.push({
      name: 'consistency',
      result: checkCrossSourceConsistency(
        { price: data.price, source: data.currentSource },
        data.altSource,
      ),
    });
  }

  // 综合判定
  const levels = checks.map(c => c.result.level);
  let overall: 'ok' | 'warning' | 'error' = 'ok';
  if (levels.includes('error')) overall = 'error';
  else if (levels.includes('warning')) overall = 'warning';

  return { overall, checks };
}
