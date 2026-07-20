'use client';

import { useState, useEffect } from 'react';
import type { ComprehensiveSentiment } from '@/services/sentiment/types';
import { fetchWithRetry } from '@/lib/api-client';

interface SentimentSummaryProps {
  stockCode?: string;
  stockName?: string;
  sectorName?: string;
}

export function SentimentSummary({ stockCode, stockName, sectorName }: SentimentSummaryProps) {
  const [sentiment, setSentiment] = useState<ComprehensiveSentiment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSentiment = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ action: 'comprehensive_sentiment' });
        if (stockCode) params.set('code', stockCode);
        if (sectorName) params.set('sector', sectorName);
        const res = await fetchWithRetry(`/api/stock?${params}`);
        const json = await res.json();
        if (json.success) {
          setSentiment(json.data);
        }
      } catch (error) {
        console.error('Failed to load sentiment:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSentiment();
  }, [stockCode, sectorName]);

  if (loading) {
    return (
      <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
        <div className="text-xs text-[var(--text-secondary)]">加载情绪数据中...</div>
      </div>
    );
  }

  if (!sentiment) {
    return (
      <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
        <div className="text-xs text-[var(--text-secondary)]">暂无情绪数据</div>
      </div>
    );
  }

  const getLevelFromScore = (score: number): string => {
    if (score >= 80) return '极度贪婪';
    if (score >= 60) return '贪婪';
    if (score >= 40) return '中性';
    if (score >= 20) return '恐慌';
    return '极度恐慌';
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case '极度恐慌': return 'text-[var(--accent-red)]';
      case '恐慌': return 'text-red-300';
      case '中性': return 'text-[var(--accent-yellow)]';
      case '贪婪': return 'text-green-300';
      case '极度贪婪': return 'text-[var(--accent-green)]';
      case '爆热': return 'text-[var(--accent-red)]';
      case '热门': return 'text-orange-400';
      case '温和': return 'text-[var(--accent-yellow)]';
      case '冷门': return 'text-[var(--accent-blue)]';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  return (
    <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3 space-y-2">
      <div className="text-xs text-[var(--text-secondary)] font-medium">情绪摘要</div>
      
      {/* 大盘情绪 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">大盘</span>
        <span className={`text-xs font-medium ${getLevelColor(sentiment.market.level)}`}>
          {sentiment.market.level} ({sentiment.market.score.toFixed(0)})
        </span>
      </div>

      {/* 板块情绪 */}
      {sentiment.sector && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">板块</span>
          <span className={`text-xs font-medium ${getLevelColor(sentiment.sector.level)}`}>
            {sentiment.sector.level} ({sentiment.sector.score.toFixed(0)})
          </span>
        </div>
      )}

      {/* 个股情绪 */}
      {sentiment.stock && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">个股</span>
          <span className={`text-xs font-medium ${getLevelColor(getLevelFromScore(sentiment.stock.score))}`}>
            {getLevelFromScore(sentiment.stock.score)} ({sentiment.stock.score.toFixed(0)})
          </span>
        </div>
      )}

      {/* 综合建议 */}
      {sentiment.suggestion && (
        <div className="pt-2 border-t border-[var(--border-default)]">
          <div className="text-xs text-[var(--text-secondary)]">
            建议: <span className="text-[var(--text-primary)]">{sentiment.suggestion}</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            风险: <span className="text-[var(--text-primary)]">{sentiment.riskLevel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
