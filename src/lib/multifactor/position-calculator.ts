// 仓位计算引擎
// 最终仓位 = 基础仓位 × 修正系数

import type { PositionResult, SentimentMode } from './types';

// ============ 基础仓位映射 ============

/**
 * 综合评分 → 基础仓位（5%一档）
 */
export function getBasePosition(compositeScore: number): number {
  if (compositeScore >= 4.0) return 95;
  if (compositeScore >= 3.0) return 80;
  if (compositeScore >= 2.0) return 65;
  if (compositeScore >= 1.0) return 50;
  if (compositeScore >= 0.5) return 35;
  if (compositeScore >= -0.5) return 20;
  if (compositeScore >= -1.0) return 10;
  if (compositeScore >= -2.0) return 5;
  return 0; // -3.0 ~ -5.0
}

// ============ 修正系数矩阵 ============

/** 情绪评分区间索引（将连续评分映射到11档整数索引0-10） */
function sentimentToIndex(score: number): number {
  // score: -5 ~ +5 → index: 0 ~ 10
  const clamped = Math.max(-5, Math.min(5, score));
  const rounded = Math.round(clamped);
  return rounded + 5; // -5→0, -4→1, ..., 0→5, ..., +5→10
}

/**
 * 修正系数矩阵
 * 行：策略模式（contrarian/trend_follow/neutral）
 * 列：情绪评分（-5 ~ +5 → index 0-10）
 */
const CORRECTION_MATRIX: Record<SentimentMode, number[]> = {
  // 逆向：大盘热→减仓，大盘冷→加仓
  contrarian: [1.5, 1.4, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5],
  // 顺势：大盘热→减仓，大盘冷→也减仓
  trend_follow: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5],
  // 中性：不修正
  neutral: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
};

/**
 * 获取修正系数
 */
export function getCorrectionFactor(sentimentScore: number, mode: SentimentMode): number {
  // 防御：sentimentScore 无效时返回中性修正
  if (typeof sentimentScore !== 'number' || isNaN(sentimentScore)) {
    return 1.0;
  }
  // 防御：mode 无效时使用 neutral
  const validMode: SentimentMode = CORRECTION_MATRIX[mode] ? mode : 'neutral';
  const index = sentimentToIndex(sentimentScore);
  return CORRECTION_MATRIX[validMode][index];
}

// ============ 主函数 ============

/**
 * 计算最终仓位
 * @param compositeScore 个股综合评分（-5 ~ +5）
 * @param sentimentScore 大盘情绪评分（-5 ~ +5）
 * @param sentimentMode 策略情绪应对模式
 * @param maxPosition 单票仓位上限（%），默认100
 */
export function calculatePosition(
  compositeScore: number,
  sentimentScore: number,
  sentimentMode: SentimentMode,
  maxPosition: number = 100
): PositionResult {
  const basePosition = getBasePosition(compositeScore);
  const correctionFactor = getCorrectionFactor(sentimentScore, sentimentMode);

  // 最终仓位 = 基础仓位 × 修正系数，不超过上限
  let finalPosition = Math.round(basePosition * correctionFactor);
  finalPosition = Math.max(0, Math.min(maxPosition, Math.min(100, finalPosition)));

  return {
    compositeScore,
    basePosition,
    sentimentScore,
    sentimentMode,
    correctionFactor,
    finalPosition,
  };
}
