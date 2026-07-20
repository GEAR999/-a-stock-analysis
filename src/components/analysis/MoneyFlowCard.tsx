'use client';

import React, { useEffect, useState } from 'react';
import { fetchWithRetry } from '@/lib/api-client';
import { parseMoneyFlowResponse, calculateMoneyFlowRating, formatMoneyFlow, type MoneyFlowData } from '@/lib/money-flow';

interface MoneyFlowCardProps {
  stockCode: string;
  stockName?: string;
}

export default function MoneyFlowCard({ stockCode, stockName }: MoneyFlowCardProps) {
  const [data, setData] = useState<MoneyFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stockCode) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithRetry(`/api/money-flow?code=${stockCode}`, { timeout: 10000 });
        const json = await res.json();
        if (!cancelled) {
          if (json.success && json.data) {
            const flows = parseMoneyFlowResponse(json.data);
            const rating = calculateMoneyFlowRating(flows);
            setData({
              code: stockCode,
              name: stockName || '',
              flows,
              ...rating,
            });
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
        <div className="text-xs text-gray-500">资金流向加载中...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#111827] border border-[#1e293b] rounded p-3">
        <div className="text-xs text-gray-500">暂无资金流向数据</div>
      </div>
    );
  }

  const ratingColors: Record<string, string> = {
    '强力吸筹': 'text-red-400 bg-red-400/10',
    '温和吸筹': 'text-red-300 bg-red-300/10',
    '资金平衡': 'text-gray-300 bg-gray-300/10',
    '温和流出': 'text-green-300 bg-green-300/10',
    '主力出逃': 'text-green-400 bg-green-400/10',
  };

  const maxBarValue = Math.max(...data.flows.slice(-20).map(f => Math.abs(f.mainNetInflow)), 1);

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded p-3">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-300">资金流向</span>
        <span className={`text-xs px-2 py-0.5 rounded ${ratingColors[data.rating] || 'text-gray-400 bg-gray-400/10'}`}>
          {data.rating}
        </span>
      </div>

      {/* 今日主力净流入 */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1">今日主力净流入</div>
        <div className={`text-lg font-bold font-mono ${data.todayMainInflow > 0 ? 'text-red-400' : data.todayMainInflow < 0 ? 'text-green-400' : 'text-gray-400'}`}>
          {formatMoneyFlow(data.todayMainInflow)}
        </div>
        <div className="text-xs text-gray-500 mt-1">{data.ratingDesc}</div>
      </div>

      {/* 多日汇总 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className="text-xs text-gray-500">5日</div>
          <div className={`text-xs font-mono ${data.fiveDayMainInflow > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {formatMoneyFlow(data.fiveDayMainInflow)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">10日</div>
          <div className={`text-xs font-mono ${data.tenDayMainInflow > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {formatMoneyFlow(data.tenDayMainInflow)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">20日</div>
          <div className={`text-xs font-mono ${data.twentyDayMainInflow > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {formatMoneyFlow(data.twentyDayMainInflow)}
          </div>
        </div>
      </div>

      {/* 迷你柱状图 */}
      <div className="flex items-end gap-px h-12">
        {data.flows.slice(-20).map((flow, i) => {
          const height = Math.max(2, (Math.abs(flow.mainNetInflow) / maxBarValue) * 100);
          const isPositive = flow.mainNetInflow > 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end"
              title={`${flow.date}: ${formatMoneyFlow(flow.mainNetInflow)}`}
            >
              <div
                className={`w-full rounded-t-sm ${isPositive ? 'bg-red-400/60' : 'bg-green-400/60'}`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-600">{data.flows[Math.max(0, data.flows.length - 20)]?.date?.slice(5) || ''}</span>
        <span className="text-[10px] text-gray-600">近20日主力净流入</span>
        <span className="text-[10px] text-gray-600">{data.flows[data.flows.length - 1]?.date?.slice(5) || ''}</span>
      </div>
    </div>
  );
}
