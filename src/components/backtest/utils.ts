// 格式化工具函数
export const formatMoney = (value: number): string => {
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(2)}万`;
  return value.toFixed(2);
};

export const formatPercent = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export const formatPrice = (value: number): string => value.toFixed(2);

export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDateTime = (date: string | Date | number): string => {
  const d = new Date(date);
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ID生成
export const generateId = (): string => Math.random().toString(36).substring(2, 15);

// 计算持仓盈亏
export const calculatePositionPnL = (avgCost: number, currentPrice: number, quantity: number) => {
  const pnl = (currentPrice - avgCost) * quantity;
  const pnlPercent = ((currentPrice - avgCost) / avgCost) * 100;
  return { pnl, pnlPercent };
};

// 计算账户总资产
export const calculateTotalAssets = (cash: number, positions: Array<{ avgCost: number; quantity: number }>): number => {
  return cash + positions.reduce((sum, p) => sum + p.quantity * p.avgCost, 0);
};
