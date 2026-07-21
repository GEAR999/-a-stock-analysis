/**
 * 策略桥接模块 - 连接抽象理论维度与具体信号维度
 *
 * strategy-storage.ts 的 QuantStrategy.theories (chanlun/wave/technical)
 *          ↕  双向映射
 * backtest-engine.ts 的 StrategyType (macd_golden_cross/chanlun_buy/...)
 */
import type { StrategySource } from '@/components/backtest/types';
import type { StrategyType } from '@/lib/backtest-engine';

// ===== 理论 → 信号列表 =====

const THEORY_TO_SIGNALS: Record<Exclude<StrategySource, 'manual' | 'composite'>, StrategyType[]> = {
  chanlun: ['chanlun_buy', 'chanlun_sell'],
  wave: ['wave_buy', 'wave_sell'],
  technical: [
    'macd_golden_cross', 'macd_death_cross',
    'kdj_oversold', 'kdj_overbought',
    'rsi_oversold', 'rsi_overbought',
    'boll_lower_touch', 'boll_upper_touch',
    'ma_golden_cross', 'ma_death_cross',
  ],
};

// ===== 信号 → 所属理论 =====

const SIGNAL_TO_THEORY: Record<StrategyType, StrategySource> = {
  chanlun_buy: 'chanlun',
  chanlun_sell: 'chanlun',
  wave_buy: 'wave',
  wave_sell: 'wave',
  macd_golden_cross: 'technical',
  macd_death_cross: 'technical',
  kdj_oversold: 'technical',
  kdj_overbought: 'technical',
  rsi_oversold: 'technical',
  rsi_overbought: 'technical',
  boll_lower_touch: 'technical',
  boll_upper_touch: 'technical',
  ma_golden_cross: 'technical',
  ma_death_cross: 'technical',
  tech_resonance_buy: 'technical',
  tech_resonance_sell: 'technical',
};

/**
 * 将 QuantStrategy 的 theories 解析为回测引擎可执行的 StrategyType 列表
 *
 * @param theories - 策略配置中的理论列表，如 ['chanlun', 'technical']
 * @returns 去重后的 StrategyType 数组
 *
 * @example
 * resolveStrategyTypes(['chanlun'])
 * // => ['chanlun_buy', 'chanlun_sell']
 *
 * resolveStrategyTypes(['chanlun', 'wave', 'technical'])
 * // => ['chanlun_buy', 'chanlun_sell', 'wave_buy', 'wave_sell', 'macd_golden_cross', ...]
 */
export function resolveStrategyTypes(theories: StrategySource[]): StrategyType[] {
  const result = new Set<StrategyType>();

  for (const theory of theories) {
    if (theory === 'composite' || theory === 'manual') {
      // composite = 全部理论; manual 不产生自动信号
      if (theory === 'composite') {
        for (const signals of Object.values(THEORY_TO_SIGNALS)) {
          for (const sig of signals) {
            result.add(sig);
          }
        }
      }
      continue;
    }
    const signals = THEORY_TO_SIGNALS[theory];
    if (signals) {
      for (const sig of signals) {
        result.add(sig);
      }
    }
  }

  return [...result];
}

/**
 * 将 StrategyType 反查其所属理论
 *
 * @example
 * signalToTheory('macd_golden_cross') // => 'technical'
 * signalToTheory('chanlun_buy')       // => 'chanlun'
 */
export function signalToTheory(signal: StrategyType): StrategySource {
  return SIGNAL_TO_THEORY[signal] ?? 'technical';
}

/**
 * 获取理论的中文标签
 */
export function getTheoryLabel(theory: StrategySource): string {
  const labels: Record<StrategySource, string> = {
    chanlun: '缠论',
    wave: '波浪理论',
    technical: '技术指标',
    composite: '综合',
    manual: '手动',
  };
  return labels[theory] ?? theory;
}

/**
 * 获取信号的中文标签
 */
export function getSignalLabel(signal: StrategyType): string {
  const labels: Record<StrategyType, string> = {
    macd_golden_cross: 'MACD金叉',
    macd_death_cross: 'MACD死叉',
    kdj_oversold: 'KDJ超卖金叉',
    kdj_overbought: 'KDJ超买死叉',
    rsi_oversold: 'RSI超卖',
    rsi_overbought: 'RSI超买',
    boll_lower_touch: '布林下轨支撑',
    boll_upper_touch: '布林上轨压力',
    ma_golden_cross: '均线金叉(5/20)',
    ma_death_cross: '均线死叉(5/20)',
    chanlun_buy: '缠论买点',
    chanlun_sell: '缠论卖点',
    wave_buy: '波浪起点买入',
    wave_sell: '波浪终点卖出',
    tech_resonance_buy: '指标共振买入',
    tech_resonance_sell: '指标共振卖出',
  };
  return labels[signal] ?? signal;
}
