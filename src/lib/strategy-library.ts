// 策略库存储逻辑 - 本地 + 云端双写
import type { StrategyType } from '@/lib/backtest-engine';

// 策略类型
export type StrategyCategory = 'builtin' | 'custom' | 'ai_generated';

// 策略定义
export interface StrategyDefinition {
  id: string;
  name: string;
  category: StrategyCategory;
  description: string;
  // 内置策略对应 backtest-engine 的 StrategyType
  builtinKey?: StrategyType;
  // 自定义策略参数
  parameters?: Record<string, unknown>;
  rules?: {
    buyConditions?: string;
    sellConditions?: string;
  };
  // AI生成摘要
  aiSummary?: string;
  aiTags?: string[];
  // 元数据
  isFavorite: boolean;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 内置策略列表
const BUILTIN_STRATEGIES: StrategyDefinition[] = [
  {
    id: 'builtin_macd_golden_cross',
    name: 'MACD金叉',
    category: 'builtin',
    description: 'DIF上穿DEA时买入，DIF下穿DEA时卖出。适合趋势行情，震荡市易产生假信号。',
    builtinKey: 'macd_golden_cross',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_macd_death_cross',
    name: 'MACD死叉',
    category: 'builtin',
    description: 'DIF下穿DEA时卖出，DIF上穿DEA时买入。与金叉策略配合使用。',
    builtinKey: 'macd_death_cross',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_kdj_oversold',
    name: 'KDJ超卖金叉',
    category: 'builtin',
    description: 'KDJ指标进入超卖区(K<20)后金叉买入。适合捕捉短线反弹机会。',
    builtinKey: 'kdj_oversold',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_kdj_overbought',
    name: 'KDJ超买死叉',
    category: 'builtin',
    description: 'KDJ指标进入超买区(K>80)后死叉卖出。适合短线止盈。',
    builtinKey: 'kdj_overbought',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_rsi_oversold',
    name: 'RSI超卖',
    category: 'builtin',
    description: 'RSI跌入超卖区(<30)时买入。适合逆势抄底。',
    builtinKey: 'rsi_oversold',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_rsi_overbought',
    name: 'RSI超买',
    category: 'builtin',
    description: 'RSI进入超买区(>70)时卖出。适合止盈。',
    builtinKey: 'rsi_overbought',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_boll_lower_touch',
    name: '布林下轨支撑',
    category: 'builtin',
    description: '价格触及布林带下轨时买入。适合震荡区间交易。',
    builtinKey: 'boll_lower_touch',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_boll_upper_touch',
    name: '布林上轨压力',
    category: 'builtin',
    description: '价格触及布林带上轨时卖出。适合震荡区间止盈。',
    builtinKey: 'boll_upper_touch',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_ma_golden_cross',
    name: '均线金叉(5/20)',
    category: 'builtin',
    description: '5日均线上穿20日均线时买入。经典趋势跟踪策略。',
    builtinKey: 'ma_golden_cross',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_ma_death_cross',
    name: '均线死叉(5/20)',
    category: 'builtin',
    description: '5日均线下穿20日均线时卖出。经典趋势跟踪卖出信号。',
    builtinKey: 'ma_death_cross',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_chanlun_buy',
    name: '缠论买点',
    category: 'builtin',
    description: '基于缠论理论识别一买、二买、三买信号。需要足够K线数据形成笔和线段。',
    builtinKey: 'chanlun_buy',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_chanlun_sell',
    name: '缠论卖点',
    category: 'builtin',
    description: '基于缠论理论识别一卖、二卖、三卖信号。',
    builtinKey: 'chanlun_sell',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_wave_buy',
    name: '波浪起点买入',
    category: 'builtin',
    description: '识别波浪理论推动浪起点(第1浪起点)买入。',
    builtinKey: 'wave_buy',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_wave_sell',
    name: '波浪终点卖出',
    category: 'builtin',
    description: '识别波浪理论推动浪终点(第5浪终点)卖出。',
    builtinKey: 'wave_sell',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_tech_resonance_buy',
    name: '指标共振买入',
    category: 'builtin',
    description: '多个技术指标同时发出买入信号时触发。信号可靠性更高但交易次数较少。',
    builtinKey: 'tech_resonance_buy',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin_tech_resonance_sell',
    name: '指标共振卖出',
    category: 'builtin',
    description: '多个技术指标同时发出卖出信号时触发。',
    builtinKey: 'tech_resonance_sell',
    isFavorite: false,
    usageCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
];

const STORAGE_KEY = 'strategy_library';

// 获取所有策略
export function getAllStrategies(): StrategyDefinition[] {
  const customStrategies = getCustomStrategies();
  return [...BUILTIN_STRATEGIES, ...customStrategies];
}

// 获取内置策略
export function getBuiltinStrategies(): StrategyDefinition[] {
  return [...BUILTIN_STRATEGIES];
}

// 获取自定义策略
export function getCustomStrategies(): StrategyDefinition[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as StrategyDefinition[];
  } catch {
    return [];
  }
}

// 保存自定义策略
export function saveCustomStrategy(strategy: StrategyDefinition): void {
  const custom = getCustomStrategies();
  const idx = custom.findIndex(s => s.id === strategy.id);
  if (idx >= 0) {
    custom[idx] = { ...strategy, updatedAt: new Date().toISOString() };
  } else {
    custom.push(strategy);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

// 删除自定义策略
export function deleteCustomStrategy(id: string): void {
  if (id.startsWith('builtin_')) return; // 不能删除内置策略
  const custom = getCustomStrategies();
  const filtered = custom.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// 切换收藏状态
export function toggleFavorite(id: string): void {
  if (id.startsWith('builtin_')) {
    // 内置策略收藏存在单独key
    const favs = getBuiltinFavorites();
    if (favs.includes(id)) {
      localStorage.setItem('builtin_strategy_favorites', JSON.stringify(favs.filter(f => f !== id)));
    } else {
      favs.push(id);
      localStorage.setItem('builtin_strategy_favorites', JSON.stringify(favs));
    }
  } else {
    const custom = getCustomStrategies();
    const strategy = custom.find(s => s.id === id);
    if (strategy) {
      strategy.isFavorite = !strategy.isFavorite;
      strategy.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    }
  }
}

// 获取内置策略收藏
function getBuiltinFavorites(): string[] {
  try {
    const data = localStorage.getItem('builtin_strategy_favorites');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 增加使用次数
export function incrementUsage(id: string): void {
  if (id.startsWith('builtin_')) return;
  const custom = getCustomStrategies();
  const strategy = custom.find(s => s.id === id);
  if (strategy) {
    strategy.usageCount++;
    strategy.lastUsedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  }
}

// 根据ID获取策略
export function getStrategyById(id: string): StrategyDefinition | undefined {
  return getAllStrategies().find(s => s.id === id);
}

// 根据builtinKey获取策略
export function getStrategyByBuiltinKey(key: StrategyType): StrategyDefinition | undefined {
  return BUILTIN_STRATEGIES.find(s => s.builtinKey === key);
}

// 生成唯一ID
export function generateStrategyId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// 导出策略为JSON
export function exportStrategies(ids: string[]): string {
  const strategies = ids.map(id => getStrategyById(id)).filter(Boolean);
  return JSON.stringify(strategies, null, 2);
}

// 导入策略
export function importStrategies(json: string): number {
  try {
    const imported = JSON.parse(json) as StrategyDefinition[];
    const custom = getCustomStrategies();
    let count = 0;
    for (const s of imported) {
      if (!s.id.startsWith('builtin_') && !custom.find(c => c.id === s.id)) {
        custom.push({
          ...s,
          id: generateStrategyId(), // 生成新ID避免冲突
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        count++;
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    return count;
  } catch {
    return 0;
  }
}
