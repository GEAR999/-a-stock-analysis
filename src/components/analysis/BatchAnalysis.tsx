'use client';

import { useState, useCallback } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { analyzeChanlun, analyzeWaves, getAllIndicators, generateAdvice } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';

interface BatchResult {
  code: string;
  name: string;
  score: number;
  overall: string;
  macdSignal: string;
  kdjSignal: string;
  chanlunSignal: string;
  wavePosition: string;
  advice: string;
}

export function BatchAnalysis() {
  const { watchlist } = useAppState();
  const [results, setResults] = useState<BatchResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
  const [sortAsc, setSortAsc] = useState(false);

  const runBatchAnalysis = useCallback(async () => {
    if (watchlist.length === 0 || isRunning) return;

    setIsRunning(true);
    setProgress({ current: 0, total: watchlist.length });
    setResults([]);

    const newResults: BatchResult[] = [];

    for (let i = 0; i < watchlist.length; i++) {
      const stock = watchlist[i];
      setProgress({ current: i + 1, total: watchlist.length });

      try {
        // Fetch K-line data
        const response = await fetch(`/api/stock?action=kline&code=${stock.code}&period=daily&limit=120`);
        const data = await response.json();

        if (!data.success || !data.data || data.data.length < 30) {
          newResults.push({
            code: stock.code,
            name: stock.name,
            score: 0,
            overall: '数据不足',
            macdSignal: '-',
            kdjSignal: '-',
            chanlunSignal: '-',
            wavePosition: '-',
            advice: 'K线数据不足，无法分析',
          });
          setResults([...newResults]);
          continue;
        }

        const klineData: KLineData[] = data.data;

        // Run analysis
        const indicators = getAllIndicators(klineData);
        const chanlun = analyzeChanlun(klineData);
        const wave = analyzeWaves(klineData);
        const advice = generateAdvice(klineData, indicators, chanlun, wave);

        // Extract signals
        const lastMACD = indicators.macd[indicators.macd.length - 1];
        const lastKDJ = indicators.kdj[indicators.kdj.length - 1];
        const macdSignal = lastMACD.histogram > 0 ? '多头' : lastMACD.histogram < 0 ? '空头' : '中性';
        const kdjSignal = lastKDJ.k > lastKDJ.d ? '金叉' : lastKDJ.k < lastKDJ.d ? '死叉' : '中性';

        let chanlunSignal = '-';
        if (chanlun.buySignals.length > 0) {
          const lastBuy = chanlun.buySignals[chanlun.buySignals.length - 1];
          chanlunSignal = `${lastBuy.type}买点`;
        } else if (chanlun.sellSignals.length > 0) {
          const lastSell = chanlun.sellSignals[chanlun.sellSignals.length - 1];
          chanlunSignal = `${lastSell.type}卖点`;
        }

        let wavePosition = '-';
        if (wave.waves.length > 0) {
          const lastWave = wave.waves[wave.waves.length - 1];
          wavePosition = `${lastWave.label}浪`;
        }

        newResults.push({
          code: stock.code,
          name: stock.name,
          score: advice.score,
          overall: advice.overall,
          macdSignal,
          kdjSignal,
          chanlunSignal,
          wavePosition,
          advice: advice.details[0] || '-',
        });

        setResults([...newResults]);
      } catch (error) {
        newResults.push({
          code: stock.code,
          name: stock.name,
          score: 0,
          overall: '分析失败',
          macdSignal: '-',
          kdjSignal: '-',
          chanlunSignal: '-',
          wavePosition: '-',
          advice: '分析出错，请重试',
        });
        setResults([...newResults]);
      }
    }

    setIsRunning(false);
  }, [watchlist, isRunning]);

  const exportCSV = () => {
    if (results.length === 0) return;

    const headers = ['股票代码', '股票名称', '综合评分', '综合建议', 'MACD信号', 'KDJ信号', '缠论信号', '波浪位置', '操作建议'];
    const rows = results.map(r => [
      r.code, r.name, r.score.toString(), r.overall,
      r.macdSignal, r.kdjSignal, r.chanlunSignal, r.wavePosition, r.advice
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `批量分析_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === 'score') {
      return sortAsc ? a.score - b.score : b.score - a.score;
    }
    return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
  });

  const handleSort = (field: 'score' | 'name') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  if (watchlist.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-[#94a3b8]">
        请先添加股票到自选列表
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e293b]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#e2e8f0]">批量分析</span>
          <span className="text-xs text-[#94a3b8]">共 {watchlist.length} 只股票</span>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && (
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 text-xs bg-[#1e293b] text-[#e2e8f0] rounded hover:bg-[#334155] transition-colors"
            >
              导出CSV
            </button>
          )}
          <button
            onClick={runBatchAnalysis}
            disabled={isRunning}
            className="px-3 py-1.5 text-xs bg-[#3b82f6] text-white rounded hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? '分析中...' : '开始分析'}
          </button>
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="px-4 py-2 bg-[#111827] border-b border-[#1e293b]">
          <div className="flex items-center justify-between text-xs text-[#94a3b8] mb-1">
            <span>分析进度</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3b82f6] transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="flex-1 overflow-auto">
        {results.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[#94a3b8]">
            点击"开始分析"对自选股进行批量分析
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a0e17] border-b border-[#1e293b]">
              <tr className="text-[#94a3b8]">
                <th className="px-3 py-2 text-left font-medium">股票</th>
                <th
                  className="px-3 py-2 text-right font-medium cursor-pointer hover:text-[#e2e8f0]"
                  onClick={() => handleSort('score')}
                >
                  评分 {sortBy === 'score' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2 text-center font-medium">建议</th>
                <th className="px-3 py-2 text-center font-medium">MACD</th>
                <th className="px-3 py-2 text-center font-medium">KDJ</th>
                <th className="px-3 py-2 text-center font-medium">缠论</th>
                <th className="px-3 py-2 text-center font-medium">波浪</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((r) => (
                <tr key={r.code} className="border-b border-[#1e293b]/50 hover:bg-[#111827]">
                  <td className="px-3 py-2">
                    <div className="text-[#e2e8f0]">{r.name}</div>
                    <div className="text-[#94a3b8] text-[10px]">{r.code}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono ${r.score >= 60 ? 'text-[#ef4444]' : r.score <= 40 ? 'text-[#22c55e]' : 'text-[#e2e8f0]'}`}>
                      {r.score}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      r.overall === '看多' ? 'bg-[#ef4444]/20 text-[#ef4444]' :
                      r.overall === '看空' ? 'bg-[#22c55e]/20 text-[#22c55e]' :
                      'bg-[#94a3b8]/20 text-[#94a3b8]'
                    }`}>
                      {r.overall}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[#94a3b8]">{r.macdSignal}</td>
                  <td className="px-3 py-2 text-center text-[#94a3b8]">{r.kdjSignal}</td>
                  <td className="px-3 py-2 text-center text-[#94a3b8]">{r.chanlunSignal}</td>
                  <td className="px-3 py-2 text-center text-[#94a3b8]">{r.wavePosition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
