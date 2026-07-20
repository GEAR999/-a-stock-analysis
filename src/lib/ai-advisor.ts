/**
 * AI Advisor - AI辅助判断模块
 * 提供AI分析接口，用于增强自动交易决策
 */

import type { KLineData, TechnicalIndicators, ChanlunResult, WaveResult } from './types';

// ===== AI Advisor 接口定义 =====

export interface AIAdvisorResponse {
  score: number;        // AI评分 0-100
  direction: 'bull' | 'bear' | 'neutral';
  confidence: number;   // AI置信度 0-100
  reasoning: string;    // AI判断理由（中文）
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AIAdvisorInput {
  stockCode: string;
  klineData: KLineData[];
  indicators: TechnicalIndicators;
  chanlunResult?: ChanlunResult;
  waveResult?: WaveResult;
  currentSignals: string[];
}

export interface AIAdvisor {
  name: string;
  analyze(input: AIAdvisorInput): Promise<AIAdvisorResponse | null>;
}

// ===== 占位适配器：NullAIAdvisor =====
// 直接返回 null，表示AI未启用

export class NullAIAdvisor implements AIAdvisor {
  name = '未启用';

  async analyze(_input: AIAdvisorInput): Promise<AIAdvisorResponse | null> {
    return null;
  }
}

// ===== 规则增强适配器：RuleBasedAIAdvisor =====
// 基于简单规则组合给出评分，作为默认实现

export class RuleBasedAIAdvisor implements AIAdvisor {
  name = '规则增强';

  async analyze(input: AIAdvisorInput): Promise<AIAdvisorResponse | null> {
    const { indicators, chanlunResult, waveResult, currentSignals, klineData } = input;

    let bullScore = 0;
    let bearScore = 0;
    const reasons: string[] = [];

    // 1. MACD信号分析
    const lastMACD = indicators.macd[indicators.macd.length - 1];
    if (lastMACD) {
      if (lastMACD.histogram > 0 && lastMACD.dif > lastMACD.dea) {
        bullScore += 15;
        if (lastMACD.dif > 0) {
          reasons.push('MACD零轴上方金叉，强势信号');
          bullScore += 5;
        } else {
          reasons.push('MACD零轴下方金叉，弱势反弹');
        }
      } else if (lastMACD.histogram < 0 && lastMACD.dif < lastMACD.dea) {
        bearScore += 15;
        if (lastMACD.dif < 0) {
          reasons.push('MACD零轴下方死叉，强势空头');
          bearScore += 5;
        } else {
          reasons.push('MACD零轴上方死叉，高位回落');
        }
      }
    }

    // 2. KDJ信号分析
    const lastKDJ = indicators.kdj[indicators.kdj.length - 1];
    if (lastKDJ && !lastKDJ.isWarmup) {
      if (lastKDJ.k < 20 && lastKDJ.d < 20) {
        bullScore += 12;
        reasons.push('KDJ超卖区域，可能存在反弹机会');
      } else if (lastKDJ.k > 80 && lastKDJ.d > 80) {
        bearScore += 12;
        reasons.push('KDJ超买区域，注意回调风险');
      }
      if (lastKDJ.k > lastKDJ.d && lastKDJ.j > lastKDJ.k) {
        bullScore += 8;
        reasons.push('KDJ金叉向上');
      } else if (lastKDJ.k < lastKDJ.d && lastKDJ.j < lastKDJ.k) {
        bearScore += 8;
        reasons.push('KDJ死叉向下');
      }
    }

    // 3. RSI信号分析
    const lastRSI = indicators.rsi[indicators.rsi.length - 1]?.rsi;
    if (lastRSI !== undefined && !isNaN(lastRSI)) {
      if (lastRSI < 30) {
        bullScore += 10;
        reasons.push(`RSI=${lastRSI.toFixed(1)}，超卖区域`);
      } else if (lastRSI > 70) {
        bearScore += 10;
        reasons.push(`RSI=${lastRSI.toFixed(1)}，超买区域`);
      }
    }

    // 4. 布林带信号分析
    const lastBOLL = indicators.boll[indicators.boll.length - 1];
    const lastClose = klineData[klineData.length - 1]?.close;
    if (lastBOLL && lastClose) {
      if (lastClose <= lastBOLL.lower) {
        bullScore += 10;
        reasons.push('价格触及布林带下轨，可能反弹');
      } else if (lastClose >= lastBOLL.upper) {
        bearScore += 10;
        reasons.push('价格触及布林带上轨，注意回调');
      }
    }

    // 5. 缠论信号分析
    if (chanlunResult) {
      const { buySignals, sellSignals } = chanlunResult;
      const recentBuy = buySignals.find(s => s.index >= klineData.length - 5);
      const recentSell = sellSignals.find(s => s.index >= klineData.length - 5);

      if (recentBuy) {
        bullScore += 20;
        reasons.push(`缠论${recentBuy.type}类买点信号`);
      }
      if (recentSell) {
        bearScore += 20;
        reasons.push(`缠论${recentSell.type}类卖点信号`);
      }

      // 中枢分析
      if (chanlunResult.centers.length > 0) {
        const lastCenter = chanlunResult.centers[chanlunResult.centers.length - 1];
        if (lastClose && lastClose > lastCenter.high) {
          bullScore += 8;
          reasons.push('价格突破中枢上沿，强势');
        } else if (lastClose && lastClose < lastCenter.low) {
          bearScore += 8;
          reasons.push('价格跌破中枢下沿，弱势');
        }
      }
    }

    // 6. 波浪理论分析
    if (waveResult && waveResult.waves.length > 0) {
      const lastWave = waveResult.waves[waveResult.waves.length - 1];
      // 获取波浪终点价格
      const waveEndIdx = lastWave.end;
      const waveEndPrice = klineData[waveEndIdx]?.close || 0;
      
      if (lastWave.type === 'impulse') {
        // 判断当前处于哪一浪（根据标签判断）
        const waveLabel = lastWave.label;
        if (waveLabel === '3' || waveLabel === '5') {
          bullScore += 15;
          reasons.push(`波浪理论：处于第${waveLabel}浪，主升浪`);
        } else if (waveLabel === '4') {
          bullScore += 5;
          reasons.push('波浪理论：处于第4浪回调，谨慎观望');
        } else {
          bullScore += 8;
          reasons.push('波浪理论：处于上升推动浪中');
        }
      } else if (lastWave.type === 'corrective') {
        // 调整浪
        const waveLabel = lastWave.label;
        if (waveLabel === 'C') {
          bearScore += 5;
          reasons.push('波浪理论：处于C浪末端，调整将结束');
          bullScore += 5; // C浪末端可能见底
        } else {
          bearScore += 10;
          reasons.push('波浪理论：当前处于调整浪中');
        }
      }
      
      // 检查价格相对波浪位置
      if (lastClose && waveEndPrice) {
        if (lastClose > waveEndPrice * 1.02) {
          bullScore += 5;
          reasons.push('价格突破波浪终点，强势');
        }
      }
    }

    // 7. 成交量配合分析
    if (klineData.length >= 6) {
      const recentVol = klineData.slice(-5).reduce((sum, k) => sum + k.volume, 0) / 5;
      const lastVol = klineData[klineData.length - 1].volume;
      const volRatio = lastVol / recentVol;

      if (volRatio > 1.5 && bullScore > bearScore) {
        bullScore += 10;
        reasons.push('放量上涨，量价配合良好');
      } else if (volRatio > 1.5 && bearScore > bullScore) {
        bearScore += 10;
        reasons.push('放量下跌，抛压较重');
      } else if (volRatio < 0.7) {
        reasons.push('成交量萎缩，观望情绪浓');
      }
    }

    // 8. 信号共振加分
    const bullSignals = currentSignals.filter(s => s.includes('买') || s.includes('金叉') || s.includes('超卖'));
    const bearSignals = currentSignals.filter(s => s.includes('卖') || s.includes('死叉') || s.includes('超买'));

    if (bullSignals.length >= 3) {
      bullScore += 15;
      reasons.push(`多信号共振看多(${bullSignals.length}个)`);
    }
    if (bearSignals.length >= 3) {
      bearScore += 15;
      reasons.push(`多信号共振看空(${bearSignals.length}个)`);
    }

    // 计算最终评分和方向
    const totalScore = bullScore + bearScore;
    let finalScore: number;
    let direction: 'bull' | 'bear' | 'neutral';

    if (totalScore === 0) {
      finalScore = 50;
      direction = 'neutral';
      reasons.push('无明显信号，建议观望');
    } else if (bullScore > bearScore * 1.3) {
      finalScore = Math.min(95, 50 + (bullScore - bearScore) / 2);
      direction = 'bull';
    } else if (bearScore > bullScore * 1.3) {
      finalScore = Math.max(5, 50 - (bearScore - bullScore) / 2);
      direction = 'bear';
    } else {
      finalScore = 50;
      direction = 'neutral';
      reasons.push('多空信号交织，方向不明');
    }

    // 计算置信度
    const signalCount = bullSignals.length + bearSignals.length;
    const confidence = Math.min(90, 30 + signalCount * 10 + (reasons.length * 5));

    // 风险等级
    let riskLevel: 'low' | 'medium' | 'high';
    if (confidence >= 70 && (direction === 'bull' || direction === 'bear')) {
      riskLevel = 'low';
    } else if (confidence >= 40) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      score: Math.round(finalScore),
      direction,
      confidence: Math.round(confidence),
      reasoning: reasons.join('；') || '无明确判断依据',
      riskLevel,
    };
  }
}

// ===== AI Advisor 工厂 =====

export type AIAdvisorType = 'none' | 'rule-based' | 'api';

export function createAIAdvisor(type: AIAdvisorType): AIAdvisor {
  switch (type) {
    case 'rule-based':
      return new RuleBasedAIAdvisor();
    case 'api':
      // 预留API接口适配器
      return new NullAIAdvisor();
    case 'none':
    default:
      return new NullAIAdvisor();
  }
}

// ===== AI辅助决策整合函数 =====

export interface FinalDecision {
  shouldTrade: boolean;
  action: 'buy' | 'sell' | 'hold';
  finalScore: number;
  aiScore?: number;
  aiReasoning?: string;
  confidence: number;
  reasoning: string;
}

/**
 * 整合AI评分与策略评分，生成最终交易决策
 * @param strategyScore 策略加权评分 (0-100)
 * @param aiResponse AI分析结果（可能为null）
 * @param aiWeight AI权重占比 (0-50)，默认20%
 * @param buyThreshold 买入阈值，默认60
 * @param sellThreshold 卖出阈值，默认40
 */
export function makeFinalDecision(
  strategyScore: number,
  aiResponse: AIAdvisorResponse | null,
  aiWeight: number = 20,
  buyThreshold: number = 60,
  sellThreshold: number = 40
): FinalDecision {
  // 如果没有AI响应，直接使用策略评分
  if (!aiResponse) {
    const shouldTrade = strategyScore >= buyThreshold || strategyScore <= sellThreshold;
    return {
      shouldTrade,
      action: strategyScore >= buyThreshold ? 'buy' : strategyScore <= sellThreshold ? 'sell' : 'hold',
      finalScore: strategyScore,
      confidence: 50,
      reasoning: `策略评分: ${strategyScore.toFixed(1)}`,
    };
  }

  // 整合AI评分和策略评分
  const aiWeightRatio = aiWeight / 100;
  const strategyWeightRatio = 1 - aiWeightRatio;

  // AI评分映射到0-100：bull=高分，bear=低分，neutral=50
  let aiMappedScore: number;
  if (aiResponse.direction === 'bull') {
    aiMappedScore = 50 + (aiResponse.score - 50) * (aiResponse.confidence / 100);
  } else if (aiResponse.direction === 'bear') {
    aiMappedScore = 50 - (50 - aiResponse.score) * (aiResponse.confidence / 100);
  } else {
    aiMappedScore = 50;
  }

  const finalScore = strategyScore * strategyWeightRatio + aiMappedScore * aiWeightRatio;

  const shouldTrade = finalScore >= buyThreshold || finalScore <= sellThreshold;
  const action = finalScore >= buyThreshold ? 'buy' : finalScore <= sellThreshold ? 'sell' : 'hold';

  // 综合置信度
  const confidence = Math.round(
    (50 * strategyWeightRatio) + (aiResponse.confidence * aiWeightRatio)
  );

  return {
    shouldTrade,
    action,
    finalScore: Math.round(finalScore * 10) / 10,
    aiScore: aiResponse.score,
    aiReasoning: aiResponse.reasoning,
    confidence,
    reasoning: `策略评分: ${strategyScore.toFixed(1)}，AI评分: ${aiResponse.score}(${aiResponse.direction})，AI判断: ${aiResponse.reasoning}`,
  };
}
