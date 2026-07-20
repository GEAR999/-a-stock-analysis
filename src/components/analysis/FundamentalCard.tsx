'use client';

import React, { useEffect, useState } from 'react';
import { fetchWithRetry } from '@/lib/api-client';
import { parseFinancialResponse, formatPercent, formatRatio, type FinancialData } from '@/lib/financial-data';

interface FundamentalCardProps {
  stockCode: string;
  stockName?: string;
}

export default function FundamentalCard({ stockCode, stockName }: FundamentalCardProps) {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stockCode) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithRetry(`/api/financial?code=${stockCode}`, { timeout: 10000 });
        const json = await res.json();
        if (!cancelled) {
          if (json.success && json.data) {
            const parsed = parseFinancialResponse(json.data);
            if (parsed) {
              setData(parsed);
            } else {
              setError('暂无数据');
            }
          } else {
            setError('暂无数据');
          }
        }
      } catch (err) {
        if (!cancelled) setError('数据获取失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [stockCode, stockName]);

  if (loading) {
    return (
      <div className="bg-[#111827] border border-[#1e293b] rounded p-3">
        <div className="text-xs text-gray-500">财务数据加载中...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#111827] border border-[#1e293b] rounded p-3">
        <div className="text-xs text-gray-500">暂无财务数据</div>
      </div>
    );
  }

  const gradeColors: Record<string, string> = {
    A: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
    B: 'text-blue-400 border-blue-400/30 bg-blue-400/5',
    C: 'text-gray-400 border-gray-400/30 bg-gray-400/5',
    D: 'text-red-400 border-red-400/30 bg-red-400/5',
  };

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded p-3">
      {/* 标题 + 评级 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-300">基本面分析</span>
        {data.grade && (
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${gradeColors[data.grade] || gradeColors.C}`}>
            <span className="text-sm font-bold">{data.grade}</span>
            <span className="text-[10px]">{data.gradeDesc}</span>
          </div>
        )}
      </div>

      {/* 核心指标：PE/PB/ROE */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center bg-[#0a0e17] rounded p-2">
          <div className="text-[10px] text-gray-500 mb-1">市盈率(PE)</div>
          <div className={`text-sm font-bold font-mono ${data.pe !== null ? (data.pe > 0 && data.pe < 30 ? 'text-green-400' : data.pe >= 30 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-500'}`}>
            {formatRatio(data.pe)}
          </div>
        </div>
        <div className="text-center bg-[#0a0e17] rounded p-2">
          <div className="text-[10px] text-gray-500 mb-1">市净率(PB)</div>
          <div className={`text-sm font-bold font-mono ${data.pb !== null ? (data.pb < 2 ? 'text-green-400' : data.pb < 5 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-500'}`}>
            {formatRatio(data.pb)}
          </div>
        </div>
        <div className="text-center bg-[#0a0e17] rounded p-2">
          <div className="text-[10px] text-gray-500 mb-1">ROE(%)</div>
          <div className={`text-sm font-bold font-mono ${data.roe !== null ? (data.roe >= 15 ? 'text-green-400' : data.roe >= 8 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-500'}`}>
            {formatPercent(data.roe)}
          </div>
        </div>
      </div>

      {/* 盈利能力 */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 mb-1.5">盈利能力</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-12">毛利率</span>
            <div className="flex-1 h-1.5 bg-[#0a0e17] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400/60 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, (data.grossMargin || 0)))}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-12 text-right">{formatPercent(data.grossMargin)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-12">净利率</span>
            <div className="flex-1 h-1.5 bg-[#0a0e17] rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-400/60 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, (data.netMargin || 0)))}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-12 text-right">{formatPercent(data.netMargin)}</span>
          </div>
        </div>
      </div>

      {/* 成长性 */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 mb-1.5">成长性</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">营收增长</span>
            <span className={`text-[10px] font-mono ${data.revenueGrowth !== null ? (data.revenueGrowth > 0 ? 'text-red-400' : 'text-green-400') : 'text-gray-500'}`}>
              {data.revenueGrowth !== null ? `${data.revenueGrowth > 0 ? '↑' : '↓'}${Math.abs(data.revenueGrowth).toFixed(1)}%` : '--'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">利润增长</span>
            <span className={`text-[10px] font-mono ${data.profitGrowth !== null ? (data.profitGrowth > 0 ? 'text-red-400' : 'text-green-400') : 'text-gray-500'}`}>
              {data.profitGrowth !== null ? `${data.profitGrowth > 0 ? '↑' : '↓'}${Math.abs(data.profitGrowth).toFixed(1)}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* 安全性 */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500">资产负债率</span>
          <span className={`text-[10px] font-mono ${data.debtRatio !== null ? (data.debtRatio > 70 ? 'text-red-400' : data.debtRatio > 50 ? 'text-yellow-400' : 'text-green-400') : 'text-gray-500'}`}>
            {formatPercent(data.debtRatio)}
          </span>
        </div>
        <div className="h-1.5 bg-[#0a0e17] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${data.debtRatio !== null && data.debtRatio > 70 ? 'bg-red-400/60' : data.debtRatio !== null && data.debtRatio > 50 ? 'bg-yellow-400/60' : 'bg-green-400/60'}`}
            style={{ width: `${Math.min(100, Math.max(0, data.debtRatio || 0))}%` }}
          />
        </div>
        {data.debtRatio !== null && data.debtRatio > 70 && (
          <div className="text-[10px] text-red-400 mt-1">⚠ 负债率偏高，注意财务风险</div>
        )}
      </div>

      {/* 报告期 */}
      {data.reportDate && (
        <div className="text-[10px] text-gray-600 mt-2">报告期：{data.reportDate}</div>
      )}
    </div>
  );
}
