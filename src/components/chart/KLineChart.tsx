'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import { useAppState } from '@/hooks/useAppState';
import { calculateMA, calculateMACD, calculateKDJ, calculateRSI, calculateBOLL, analyzeChanlun, analyzeWaves } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';

const PERIODS: Array<{ key: string; label: string }> = [
  { key: 'daily', label: '日K' },
  { key: 'weekly', label: '周K' },
  { key: 'monthly', label: '月K' },
  { key: '60min', label: '60分' },
  { key: '30min', label: '30分' },
  { key: '15min', label: '15分' },
  { key: '5min', label: '5分' },
];

export function KLineChart() {
  const { selectedStock, klineData, klinePeriod, setKlinePeriod, analysisSettings, setKlineData } = useAppState();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Fetch kline data
  useEffect(() => {
    if (!selectedStock) return;
    const fetchKline = async () => {
      try {
        const res = await fetch(`/api/stock?action=kline&code=${selectedStock.code}&period=${klinePeriod}&limit=250`);
        const json = await res.json();
        if (json.success) setKlineData(json.data);
      } catch {
        // ignore
      }
    };
    fetchKline();
  }, [selectedStock, klinePeriod, setKlineData]);

  // Build chart
  const buildChart = useCallback(() => {
    if (!chartRef.current || klineData.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark');
    }

    const chart = chartInstance.current;
    const dates = klineData.map(d => d.date);
    const ohlc = klineData.map(d => [d.open, d.close, d.low, d.high]);
    const volumes = klineData.map(d => d.volume);

    // Calculate indicators
    const maData = analysisSettings.ma ? calculateMA(klineData, analysisSettings.maPeriods) : {};
    const macdData = analysisSettings.macd ? calculateMACD(klineData) : [];
    const kdjData = analysisSettings.kdj ? calculateKDJ(klineData) : [];
    const rsiData = analysisSettings.rsi ? calculateRSI(klineData) : [];
    const bollData = analysisSettings.boll ? calculateBOLL(klineData) : [];
    const chanlunData = analysisSettings.chanlun ? analyzeChanlun(klineData) : null;
    const waveData = analysisSettings.wave ? analyzeWaves(klineData) : null;

    // Count sub-chart grids
    const subCharts: string[] = [];
    if (macdData.length > 0) subCharts.push('macd');
    if (kdjData.length > 0) subCharts.push('kdj');
    if (rsiData.length > 0) subCharts.push('rsi');

    const mainGridHeight = 50;
    const volumeGridHeight = 12;
    const subGridHeight = subCharts.length > 0 ? Math.floor((38 - volumeGridHeight) / Math.max(subCharts.length, 1)) : volumeGridHeight;

    const grids: Array<Record<string, unknown>> = [
      { left: 60, right: 30, top: '4%', height: `${mainGridHeight}%` },
      { left: 60, right: 30, top: `${mainGridHeight + 6}%`, height: `${volumeGridHeight}%` },
    ];

    const xAxes: Array<Record<string, unknown>> = [
      { type: 'category', data: dates, gridIndex: 0, axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { show: false }, axisTick: { show: false } },
      { type: 'category', data: dates, gridIndex: 1, axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { show: false }, axisTick: { show: false } },
    ];

    const yAxes: Array<Record<string, unknown>> = [
      { scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }, axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
      { scale: true, gridIndex: 1, splitLine: { show: false }, axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { show: false } },
    ];

    let currentTop = mainGridHeight + volumeGridHeight + 8;
    subCharts.forEach((name, i) => {
      grids.push({ left: 60, right: 30, top: `${currentTop}%`, height: `${subGridHeight}%` });
      xAxes.push({ type: 'category', data: dates, gridIndex: i + 2, axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8', fontSize: 9 }, axisTick: { show: false } });
      yAxes.push({ scale: true, gridIndex: i + 2, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }, axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8', fontSize: 9 } });
      currentTop += subGridHeight + 2;
    });

    // Series
    const series: Array<Record<string, unknown>> = [
      {
        name: 'K线',
        type: 'candlestick',
        data: ohlc,
        xAxisIndex: 0,
        yAxisIndex: 0,
        itemStyle: {
          color: '#ef4444',
          color0: '#22c55e',
          borderColor: '#ef4444',
          borderColor0: '#22c55e',
        },
      },
      {
        name: '成交量',
        type: 'bar',
        data: volumes.map((v, i) => ({
          value: v,
          itemStyle: { color: klineData[i].close >= klineData[i].open ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)' },
        })),
        xAxisIndex: 1,
        yAxisIndex: 1,
      },
    ];

    // MA lines
    if (analysisSettings.ma) {
      const maColors: Record<number, string> = { 5: '#f59e0b', 10: '#3b82f6', 20: '#a855f7', 60: '#22c55e', 120: '#ef4444', 250: '#94a3b8' };
      Object.entries(maData).forEach(([period, values]) => {
        series.push({
          name: `MA${period}`,
          type: 'line',
          data: values.map(v => v === 0 ? null : Math.round(v * 100) / 100),
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          lineStyle: { width: 1, color: maColors[Number(period)] || '#94a3b8' },
          symbol: 'none',
          z: 1,
        });
      });
    }

    // BOLL
    if (bollData.length > 0) {
      series.push(
        { name: 'BOLL上轨', type: 'line', data: bollData.map(d => d.upper), xAxisIndex: 0, yAxisIndex: 0, lineStyle: { width: 1, color: '#f59e0b', type: 'dashed' }, symbol: 'none', z: 1 },
        { name: 'BOLL中轨', type: 'line', data: bollData.map(d => d.middle), xAxisIndex: 0, yAxisIndex: 0, lineStyle: { width: 1, color: '#3b82f6' }, symbol: 'none', z: 1 },
        { name: 'BOLL下轨', type: 'line', data: bollData.map(d => d.lower), xAxisIndex: 0, yAxisIndex: 0, lineStyle: { width: 1, color: '#22c55e', type: 'dashed' }, symbol: 'none', z: 1 },
      );
    }

    // Chanlun overlays
    if (chanlunData) {
      // Draw strokes
      chanlunData.strokes.forEach(stroke => {
        const startPrice = stroke.direction === 'up' ? klineData[stroke.start].low : klineData[stroke.start].high;
        const endPrice = stroke.direction === 'up' ? klineData[stroke.end].high : klineData[stroke.end].low;
        series.push({
          type: 'line',
          data: new Array(stroke.start).fill(null).concat([startPrice], new Array(stroke.end - stroke.start - 1).fill(null), [endPrice]),
          xAxisIndex: 0,
          yAxisIndex: 0,
          lineStyle: { width: 1.5, color: stroke.direction === 'up' ? '#ef4444' : '#22c55e' },
          symbol: 'none',
          z: 5,
          connectNulls: false,
        } as Record<string, unknown>);
      });

      // Buy/Sell signals
      chanlunData.buySignals.forEach(sig => {
        series.push({
          type: 'scatter',
          data: [[dates[sig.index], sig.price * 0.995]],
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'triangle',
          symbolSize: 12,
          itemStyle: { color: '#ef4444' },
          z: 10,
          label: { show: true, formatter: `B${sig.type}`, position: 'bottom', color: '#ef4444', fontSize: 9 },
        } as Record<string, unknown>);
      });

      chanlunData.sellSignals.forEach(sig => {
        series.push({
          type: 'scatter',
          data: [[dates[sig.index], sig.price * 1.005]],
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'triangle',
          symbolSize: 12,
          itemStyle: { color: '#22c55e' },
          symbolRotate: 180,
          z: 10,
          label: { show: true, formatter: `S${sig.type}`, position: 'top', color: '#22c55e', fontSize: 9 },
        } as Record<string, unknown>);
      });
    }

    // Wave labels
    if (waveData) {
      waveData.waves.forEach(w => {
        const midIndex = Math.floor((w.start + w.end) / 2);
        const midPrice = klineData[midIndex]?.high || 0;
        series.push({
          type: 'scatter',
          data: [[dates[midIndex], midPrice]],
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'none',
          z: 10,
          label: { show: true, formatter: w.label, color: w.type === 'impulse' ? '#f59e0b' : '#a855f7', fontSize: 11, fontWeight: 'bold' },
        } as Record<string, unknown>);
      });
    }

    // MACD
    if (macdData.length > 0) {
      const idx = subCharts.indexOf('macd') + 2;
      series.push(
        { name: 'DIF', type: 'line', data: macdData.map(d => d.dif), xAxisIndex: idx, yAxisIndex: idx, lineStyle: { width: 1, color: '#3b82f6' }, symbol: 'none' },
        { name: 'DEA', type: 'line', data: macdData.map(d => d.dea), xAxisIndex: idx, yAxisIndex: idx, lineStyle: { width: 1, color: '#f59e0b' }, symbol: 'none' },
        {
          name: 'MACD', type: 'bar', data: macdData.map(d => ({
            value: d.histogram,
            itemStyle: { color: d.histogram >= 0 ? '#ef4444' : '#22c55e' },
          })),
          xAxisIndex: idx, yAxisIndex: idx,
        },
      );
    }

    // KDJ
    if (kdjData.length > 0) {
      const idx = subCharts.indexOf('kdj') + 2;
      series.push(
        { name: 'K', type: 'line', data: kdjData.map(d => d.k), xAxisIndex: idx, yAxisIndex: idx, lineStyle: { width: 1, color: '#3b82f6' }, symbol: 'none' },
        { name: 'D', type: 'line', data: kdjData.map(d => d.d), xAxisIndex: idx, yAxisIndex: idx, lineStyle: { width: 1, color: '#f59e0b' }, symbol: 'none' },
        { name: 'J', type: 'line', data: kdjData.map(d => d.j), xAxisIndex: idx, yAxisIndex: idx, lineStyle: { width: 1, color: '#a855f7' }, symbol: 'none' },
      );
    }

    // RSI
    if (rsiData.length > 0) {
      const idx = subCharts.indexOf('rsi') + 2;
      series.push(
        { name: 'RSI', type: 'line', data: rsiData.map(d => d.rsi), xAxisIndex: idx, yAxisIndex: idx, lineStyle: { width: 1, color: '#f59e0b' }, symbol: 'none' },
      );
    }

    const option: echarts.EChartsOption = {
      animation: false,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', lineStyle: { color: '#3b82f6', width: 0.5 } },
        backgroundColor: '#111827',
        borderColor: '#1e293b',
        textStyle: { color: '#e2e8f0', fontSize: 11 },
      },
      legend: { show: false },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      dataZoom: [
        { type: 'inside', xAxisIndex: xAxes.map((_, i) => i), start: 60, end: 100 },
        { type: 'slider', xAxisIndex: xAxes.map((_, i) => i), bottom: 5, height: 15, borderColor: '#1e293b', backgroundColor: '#0a0e17', fillerColor: 'rgba(59,130,246,0.1)', handleStyle: { color: '#3b82f6' }, textStyle: { color: '#94a3b8', fontSize: 9 } },
      ],
      series: series as echarts.SeriesOption[],
    };

    chart.setOption(option, true);
  }, [klineData, analysisSettings]);

  useEffect(() => {
    buildChart();
  }, [buildChart]);

  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, []);

  if (!selectedStock) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#94a3b8] text-sm">
        请搜索并选择一只股票开始分析
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Period selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#1e293b]">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setKlinePeriod(p.key as typeof klinePeriod)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              klinePeriod === p.key
                ? 'bg-[#3b82f6] text-white'
                : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e293b]'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs text-[#94a3b8]">
          {analysisSettings.ma && analysisSettings.maPeriods.map(p => {
            const colors: Record<number, string> = { 5: '#f59e0b', 10: '#3b82f6', 20: '#a855f7', 60: '#22c55e', 120: '#ef4444', 250: '#94a3b8' };
            return <span key={p} style={{ color: colors[p] }}>MA{p}</span>;
          })}
        </div>
      </div>

      {/* Chart */}
      <div ref={chartRef} className="flex-1 min-h-0" />
    </div>
  );
}
