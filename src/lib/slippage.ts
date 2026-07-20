/**
 * 滑点模拟工具
 * 用于模拟实际交易中的价格滑点
 */

/**
 * 计算滑点后的价格
 * @param price 原始价格
 * @param direction 交易方向 ('buy' | 'sell')
 * @param volatility 波动率 (0-1)，默认0.02表示2%
 * @returns 滑点后的价格
 */
export function applySlippage(
  price: number,
  direction: 'buy' | 'sell',
  volatility: number = 0.02
): number {
  // 基础滑点: 0.1% - 0.3%
  const baseSlippage = 0.001 + Math.random() * 0.002;
  
  // 根据波动率调整滑点幅度
  // 波动率越高，滑点越大
  const volatilityMultiplier = 1 + volatility * 10;
  const adjustedSlippage = baseSlippage * volatilityMultiplier;
  
  // 买入时价格上浮，卖出时价格下调
  if (direction === 'buy') {
    return price * (1 + adjustedSlippage);
  } else {
    return price * (1 - adjustedSlippage);
  }
}

/**
 * 计算滑点百分比
 * @param originalPrice 原始价格
 * @param actualPrice 实际价格
 * @returns 滑点百分比 (正数表示不利方向)
 */
export function calculateSlippagePercent(
  originalPrice: number,
  actualPrice: number
): number {
  return Math.abs((actualPrice - originalPrice) / originalPrice) * 100;
}

/**
 * 计算平均滑点成本
 * @param trades 交易记录数组
 * @returns 平均滑点百分比
 */
export function calculateAverageSlippage(
  trades: Array<{ suggestedPrice: number; actualPrice: number }>
): number {
  if (trades.length === 0) return 0;
  
  const totalSlippage = trades.reduce((sum, trade) => {
    return sum + calculateSlippagePercent(trade.suggestedPrice, trade.actualPrice);
  }, 0);
  
  return totalSlippage / trades.length;
}
