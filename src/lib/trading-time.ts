/**
 * A股交易时间判断工具
 */

/**
 * 判断当前是否为A股交易时间
 * 交易时段：工作日 9:30-11:30, 13:00-15:00
 * @param runMode 运行模式：'backtest' 不受限制，'realtime' 检查交易时间
 * @returns boolean 是否在交易时间内
 */
export function isTradingTime(runMode: 'backtest' | 'realtime' = 'realtime'): boolean {
  // 回测模式不限制交易时间
  if (runMode === 'backtest') return true;
  
  // 获取北京时间 (UTC+8)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijingTime = new Date(utc + 8 * 3600000);
  
  // 判断是否为工作日 (周一到周五)
  const dayOfWeek = beijingTime.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false; // 周末
  }
  
  // 获取当前时间 (小时和分钟)
  const hours = beijingTime.getHours();
  const minutes = beijingTime.getMinutes();
  const currentTime = hours * 60 + minutes; // 转换为分钟数
  
  // 上午交易时段: 9:30 - 11:30
  const morningStart = 9 * 60 + 30; // 570
  const morningEnd = 11 * 60 + 30;  // 690
  
  // 下午交易时段: 13:00 - 15:00
  const afternoonStart = 13 * 60;    // 780
  const afternoonEnd = 15 * 60;      // 900
  
  // 判断是否在交易时段内
  const isInMorningSession = currentTime >= morningStart && currentTime <= morningEnd;
  const isInAfternoonSession = currentTime >= afternoonStart && currentTime <= afternoonEnd;
  
  return isInMorningSession || isInAfternoonSession;
}

/**
 * 获取当前交易状态描述
 * @returns 交易状态文本
 */
export function getTradingStatus(): { isTrading: boolean; statusText: string; nextSession?: string } {
  const isTrading = isTradingTime();
  
  if (isTrading) {
    return {
      isTrading: true,
      statusText: '交易中',
    };
  }
  
  // 获取北京时间用于判断下一个交易时段
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijingTime = new Date(utc + 8 * 3600000);
  
  const dayOfWeek = beijingTime.getDay();
  const hours = beijingTime.getHours();
  const minutes = beijingTime.getMinutes();
  const currentTime = hours * 60 + minutes;
  
  // 周末
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      isTrading: false,
      statusText: '已休市',
      nextSession: '下周一开盘',
    };
  }
  
  // 工作日不同时段
  const morningStart = 9 * 60 + 30;
  const morningEnd = 11 * 60 + 30;
  const afternoonStart = 13 * 60;
  const afternoonEnd = 15 * 60;
  
  if (currentTime < morningStart) {
    return {
      isTrading: false,
      statusText: '已休市',
      nextSession: '今日 9:30 开盘',
    };
  }
  
  if (currentTime > morningEnd && currentTime < afternoonStart) {
    return {
      isTrading: false,
      statusText: '午间休市',
      nextSession: '今日 13:00 开盘',
    };
  }
  
  if (currentTime > afternoonEnd) {
    return {
      isTrading: false,
      statusText: '已收盘',
      nextSession: '明日 9:30 开盘',
    };
  }
  
  return {
    isTrading: false,
    statusText: '已休市',
  };
}
