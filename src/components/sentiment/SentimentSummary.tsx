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
      <div className="bg-[#111827] rounded border border-[#1e293b] p-3">
        <div className="text-xs text-[#94a3b8]">加载情绪数据中...</div>
      </div>
    );
  }

  if (!sentiment) {
    return (
      <div className="bg-[#111827] rounded border border-[#1e293b] p-3">
        <div className="text-xs text-[#94a3b8]">暂无情绪数据</div>
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
      case '极度恐慌': return 'text-red-400';
      case '恐慌': return 'text-red-300';
      case '中性': return 'text-yellow-400';
      case '贪婪': return 'text-green-300';
      case '极度贪婪': return 'text-green-400';
      case '爆热': return 'text-red-400';
      case '热门': return 'text-orange-400';
      case '温和': return 'text-yellow-400';
      case '冷门': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-[#111827] rounded border border-[#1e293b] p-3 space-y-2">
      <div className="text-xs text-[#94a3b8] font-medium">情绪摘要</div>
      
      {/* 大盘情绪 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">大盘</span>
        <span className={`text-xs font-medium ${getLevelColor(sentiment.market.level)}`}>
          {sentiment.market.level} ({sentiment.market.score.toFixed(0)})
        </span>
      </div>

      {/* 板块情绪 */}
      {sentiment.sector && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">板块</span>
          <span className={`text-xs font-medium ${getLevelColor(sentiment.sector.level)}`}>
            {sentiment.sector.level} ({sentiment.sector.score.toFixed(0)})
          </span>
        </div>
      )}

      {/* 个股情绪 */}
      {sentiment.stock && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">个股</span>
          <span className={`text-xs font-medium ${getLevelColor(getLevelFromScore(sentiment.stock.score))}`}>
            {getLevelFromScore(sentiment.stock.score)} ({sentiment.stock.score.toFixed(0)})
          </span>
        </div>
      )}

      {/* 综合建议 */}
      {sentiment.suggestion && (
        <div className="pt-2 border-t border-[#1e293b]">
          <div className="text-xs text-[#94a3b8]">
            建议: <span className="text-[#e2e8f0]">{sentiment.suggestion}</span>
          </div>
          <div className="text-xs text-[#94a3b8]">
            风险: <span className="text-[#e2e8f0]">{sentiment.riskLevel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
