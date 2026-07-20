/**
 * 自定义策略存储工具
 * 管理用户自定义的交易策略，支持CRUD操作
 */

import type { CustomStrategy, StrategyTemplate, StrategyWeight } from './types';

const CUSTOM_STRATEGIES_KEY = 'custom_strategies';
const STRATEGY_TEMPLATES_KEY = 'strategy_templates';

// ===== 自定义策略 CRUD =====

/**
 * 获取所有自定义策略
 */
export function getAllCustomStrategies(): CustomStrategy[] {
  try {
    const data = localStorage.getItem(CUSTOM_STRATEGIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * 获取单个自定义策略
 */
export function getCustomStrategy(id: string): CustomStrategy | null {
  const strategies = getAllCustomStrategies();
  return strategies.find(s => s.id === id) || null;
}

/**
 * 保存自定义策略（新增或更新）
 */
export function saveCustomStrategy(strategy: CustomStrategy): void {
  const strategies = getAllCustomStrategies();
  const index = strategies.findIndex(s => s.id === strategy.id);
  
  if (index >= 0) {
    strategies[index] = { ...strategy, updatedAt: Date.now() };
  } else {
    strategies.push(strategy);
  }
  
  localStorage.setItem(CUSTOM_STRATEGIES_KEY, JSON.stringify(strategies));
}

/**
 * 删除自定义策略
 */
export function deleteCustomStrategy(id: string): void {
  const strategies = getAllCustomStrategies();
  const filtered = strategies.filter(s => s.id !== id);
  localStorage.setItem(CUSTOM_STRATEGIES_KEY, JSON.stringify(filtered));
}

/**
 * 创建新的自定义策略（生成ID）
 */
export function createNewCustomStrategy(): CustomStrategy {
  return {
    id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: '新策略',
    description: '',
    theories: [],
    buyConditions: {},
    sellConditions: {},
    positionRatio: 0.3,
    stopLoss: 0.1,
    takeProfit: 0.2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ===== 策略模板 CRUD =====

/**
 * 获取所有策略模板
 */
export function getAllStrategyTemplates(): StrategyTemplate[] {
  try {
    const data = localStorage.getItem(STRATEGY_TEMPLATES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * 获取单个策略模板
 */
export function getStrategyTemplate(id: string): StrategyTemplate | null {
  const templates = getAllStrategyTemplates();
  return templates.find(t => t.id === id) || null;
}

/**
 * 保存策略模板（新增或更新）
 */
export function saveStrategyTemplate(template: StrategyTemplate): void {
  const templates = getAllStrategyTemplates();
  const index = templates.findIndex(t => t.id === template.id);
  
  if (index >= 0) {
    templates[index] = { ...template, updatedAt: Date.now() };
  } else {
    templates.push(template);
  }
  
  localStorage.setItem(STRATEGY_TEMPLATES_KEY, JSON.stringify(templates));
}

/**
 * 删除策略模板
 */
export function deleteStrategyTemplate(id: string): void {
  const templates = getAllStrategyTemplates();
  const filtered = templates.filter(t => t.id !== id);
  localStorage.setItem(STRATEGY_TEMPLATES_KEY, JSON.stringify(filtered));
}

/**
 * 创建新的策略模板
 */
export function createNewStrategyTemplate(name: string, weights: StrategyWeight[], threshold: number): StrategyTemplate {
  return {
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    weights,
    tradeThreshold: threshold,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ===== 系统内置策略 =====

export interface BuiltinStrategy {
  id: string;
  name: string;
  description: string;
  theories: string[];
  confidence: number;
  source: 'builtin';
}

/**
 * 获取系统内置策略列表
 */
export function getBuiltinStrategies(): BuiltinStrategy[] {
  return [
    {
      id: 'builtin_chanlun',
      name: '缠论策略',
      description: '基于缠论的买卖点识别，包括一买、二买、三买信号',
      theories: ['chanlun'],
      confidence: 75,
      source: 'builtin',
    },
    {
      id: 'builtin_wave',
      name: '波浪策略',
      description: '基于波浪理论的浪型识别和趋势判断',
      theories: ['wave'],
      confidence: 65,
      source: 'builtin',
    },
    {
      id: 'builtin_technical',
      name: '技术指标策略',
      description: '基于MACD、KDJ、RSI等技术指标的综合分析',
      theories: ['technical'],
      confidence: 70,
      source: 'builtin',
    },
    {
      id: 'builtin_ma',
      name: '均线策略',
      description: '基于均线系统的多空判断和交叉信号',
      theories: ['technical'],
      confidence: 60,
      source: 'builtin',
    },
    {
      id: 'builtin_macd',
      name: 'MACD策略',
      description: '基于MACD金叉死叉和背离信号',
      theories: ['technical'],
      confidence: 68,
      source: 'builtin',
    },
    {
      id: 'builtin_rsi',
      name: 'RSI策略',
      description: '基于RSI超买超卖和背离信号',
      theories: ['technical'],
      confidence: 62,
      source: 'builtin',
    },
    {
      id: 'builtin_boll',
      name: '布林带策略',
      description: '基于布林带的突破和回归信号',
      theories: ['technical'],
      confidence: 65,
      source: 'builtin',
    },
    {
      id: 'builtin_comprehensive',
      name: '综合策略',
      description: '综合缠论、波浪、技术指标的多理论共振策略',
      theories: ['chanlun', 'wave', 'technical'],
      confidence: 80,
      source: 'builtin',
    },
  ];
}

/**
 * 获取所有可用策略（内置 + 自定义）
 */
export function getAllAvailableStrategies(): Array<BuiltinStrategy | CustomStrategy> {
  const builtin = getBuiltinStrategies();
  const custom = getAllCustomStrategies();
  return [...builtin, ...custom];
}

// ===== 权重计算工具 =====

/**
 * 按置信度自动分配权重
 */
/**
 * 最大余数法分配权重（保证总和精确等于100）
 * 算法：
 * 1. 计算每个策略的精确权重（浮点数）
 * 2. 取整数部分作为初始分配
 * 3. 计算剩余百分点 = 100 - 所有整数部分之和
 * 4. 按小数部分从大到小排序，把剩余百分点依次分配给小数部分最大的策略
 */
function largestRemainderAllocation(values: number[], total: number = 100): number[] {
  if (values.length === 0) return [];
  
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    // 如果所有值都是0，均分
    const base = Math.floor(total / values.length);
    const remainder = total - base * values.length;
    return values.map((_, i) => base + (i < remainder ? 1 : 0));
  }
  
  // 计算精确权重和整数部分
  const exactWeights = values.map(v => (v / sum) * total);
  const floorWeights = exactWeights.map(w => Math.floor(w));
  
  // 计算剩余百分点
  const currentSum = floorWeights.reduce((a, b) => a + b, 0);
  let remainder = total - currentSum;
  
  // 计算小数部分并排序
  const fractions = exactWeights.map((w, i) => ({
    index: i,
    fraction: w - Math.floor(w),
  }));
  
  // 按小数部分从大到小排序
  fractions.sort((a, b) => b.fraction - a.fraction);
  
  // 分配剩余百分点
  const result = [...floorWeights];
  for (let i = 0; i < remainder && i < fractions.length; i++) {
    result[fractions[i].index] += 1;
  }
  
  return result;
}

/**
 * 根据置信度计算权重（使用最大余数法保证总和为100）
 */
export function calculateWeightsByConfidence(
  strategies: Array<{ id: string; confidence: number }>
): StrategyWeight[] {
  const confidences = strategies.map(s => s.confidence);
  const weights = largestRemainderAllocation(confidences, 100);
  
  return strategies.map((s, i) => ({
    strategyId: s.id,
    strategyName: '',
    weight: weights[i],
    confidence: s.confidence,
    enabled: true,
    source: s.id.startsWith('builtin_') ? 'builtin' as const : 'custom' as const,
  }));
}

/**
 * 均分权重（使用最大余数法保证总和为100）
 */
export function calculateEqualWeights(strategyIds: string[]): StrategyWeight[] {
  const equalValues = strategyIds.map(() => 1); // 等置信度
  const weights = largestRemainderAllocation(equalValues, 100);
  
  return strategyIds.map((id, index) => ({
    strategyId: id,
    strategyName: '',
    weight: weights[index],
    confidence: 0,
    enabled: true,
    source: id.startsWith('builtin_') ? 'builtin' as const : 'custom' as const,
  }));
}

/**
 * 手动调整权重：当用户修改某个策略权重时，按比例调整其他策略使总和保持100
 * @param weights 当前权重数组
 * @param changedIndex 被修改的策略索引
 * @param newValue 新的权重值
 * @returns 调整后的权重数组
 */
export function adjustWeightManually(
  weights: StrategyWeight[],
  changedIndex: number,
  newValue: number
): StrategyWeight[] {
  if (changedIndex < 0 || changedIndex >= weights.length) return weights;
  if (newValue < 0 || newValue > 100) return weights;
  
  const result = weights.map(w => ({ ...w }));
  result[changedIndex].weight = newValue;
  
  // 计算剩余需要分配的权重
  const remaining = 100 - newValue;
  
  // 获取其他启用的策略
  const otherIndices = result
    .map((w, i) => ({ index: i, weight: w.weight, enabled: w.enabled }))
    .filter((_, i) => i !== changedIndex && result[i].enabled);
  
  if (otherIndices.length === 0) {
    // 如果没有其他策略，直接返回
    return result;
  }
  
  const otherTotal = otherIndices.reduce((sum, o) => sum + o.weight, 0);
  
  if (otherTotal === 0) {
    // 如果其他策略权重都是0，均分剩余权重
    const base = Math.floor(remaining / otherIndices.length);
    let extra = remaining - base * otherIndices.length;
    
    for (const o of otherIndices) {
      result[o.index].weight = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
    }
  } else {
    // 按比例缩放其他策略的权重
    const scale = remaining / otherTotal;
    const scaledWeights = otherIndices.map(o => o.weight * scale);
    const flooredWeights = scaledWeights.map(w => Math.floor(w));
    
    // 使用最大余数法分配剩余
    let currentSum = newValue + flooredWeights.reduce((a, b) => a + b, 0);
    let remainder = 100 - currentSum;
    
    const fractions = scaledWeights.map((w, i) => ({
      origIndex: otherIndices[i].index,
      fraction: w - Math.floor(w),
    }));
    fractions.sort((a, b) => b.fraction - a.fraction);
    
    for (let i = 0; i < otherIndices.length; i++) {
      result[otherIndices[i].index].weight = flooredWeights[i];
    }
    
    for (let i = 0; i < remainder && i < fractions.length; i++) {
      result[fractions[i].origIndex].weight += 1;
    }
  }
  
  return result;
}

/**
 * 验证权重总和是否为100
 */
export function validateWeights(weights: StrategyWeight[]): boolean {
  const total = weights.filter(w => w.enabled).reduce((sum, w) => sum + w.weight, 0);
  return total === 100;
}

// ===== 导出/导入 =====

/**
 * 导出策略配置为JSON
 */
export function exportStrategiesConfig(): string {
  const config = {
    version: '1.0',
    exportedAt: Date.now(),
    customStrategies: getAllCustomStrategies(),
    templates: getAllStrategyTemplates(),
  };
  return JSON.stringify(config, null, 2);
}

/**
 * 导入策略配置
 */
export function importStrategiesConfig(json: string): { success: boolean; error?: string } {
  try {
    const config = JSON.parse(json);
    
    if (config.customStrategies && Array.isArray(config.customStrategies)) {
      localStorage.setItem(CUSTOM_STRATEGIES_KEY, JSON.stringify(config.customStrategies));
    }
    
    if (config.templates && Array.isArray(config.templates)) {
      localStorage.setItem(STRATEGY_TEMPLATES_KEY, JSON.stringify(config.templates));
    }
    
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
