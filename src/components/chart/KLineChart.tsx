'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import { useAppState } from '@/hooks/useAppState';
import { calculateMA, calculateMACD, calculateKDJ, calculateRSI, calculateBOLL, analyzeChanlun, analyzeWaves } from '@/lib/analysis';
import { fetchWithRetry, onOnlineStatusChange } from '@/lib/api-client';
import type { KLineData } from '@/lib/types';
import type { DataSourceError } from '@/lib/data-source';
import { AlertCircle, RefreshCw } from 'lucide-react';

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
  const [error, setError] = useState<{ type: DataSourceError; message: string; suggestion: string } | null>(null);
  const [showError, setShowError] = useState(false);

  // Fetch kline data (backend handles caching)
  useEffect(() => {
    if (!selectedStock) return;
    let cancelled = false;

    const fetchKline = async () => {
      setError(null);
      setShowError(false);
      try {
        const res = await fetchWithRetry(`/api/stock?action=kline&code=${selectedStock.code}&period=${klinePeriod}&limit=250`);
        const json = await res.json();
        if (json.success && !cancelled) {
          setKlineData(json.data);
          // 数据来源调试信息（可选）
          if (json.source) {
            console.log(`[KLine] Data source: ${json.source}`);
          }
        } else if (!cancelled && json.error) {
          // 数据加载失败，显示错误提示
          setError({
            type: json.error,
            message: json.errorMessage || '数据加载失败',
            suggestion: json.suggestion || '请稍后重试',
          });
          setShowError(true);
        }
      } catch {
        if (!cancelled) {
          setError({
            type: 'NETWORK_ERROR' as DataSourceError,
            message: '网络连接异常',
            suggestion: '请检查网络设置或刷新页面',
          });
          setShowError(true);
        }
      }
    };
    fetchKline();

    return () => { cancelled = true; };
  }, [selectedStock, klinePeriod, setKlineData]);

  // Listen for auto-refresh event
  useEffect(() => {
    const handleAutoRefresh = () => {
      if (selectedStock) {
        handleRefresh();
      }
    };
    window.addEventListener('auto-refresh', handleAutoRefresh);
    return () => window.removeEventListener('auto-refresh', handleAutoRefresh);
  }, [selectedStock, klinePeriod]);

  // Build chart
  const [showLegend, setShowLegend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100); // percentage of visible data
  const [hoveredData, setHoveredData] = useState<{
    date: string; open: number; high: number; low: number; close: number;
    volume: number; change: number; changePercent: number;
  } | null>(null);

  const handleRefresh = async () => {
    if (!selectedStock) return;
    setLoading(true);
    setError(null);
    setShowError(false);
    try {
      const res = await fetchWithRetry(`/api/stock?action=kline&code=${selectedStock.code}&period=${klinePeriod}&limit=120`);
      const json = await res.json();
      if (json.success) {
        setKlineData(json.data);
      } else if (json.error) {
        setError({
          type: json.error,
          message: json.errorMessage || '数据加载失败',
          suggestion: json.suggestion || '请稍后重试',
        });
        setShowError(true);
      }
    } catch (e) {
      console.error('Refresh kline failed:', e);
      setError({
        type: 'NETWORK_ERROR' as DataSourceError,
        message: '网络连接异常',
        suggestion: '请检查网络设置或刷新页面',
      });
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  // 重试处理（清除缓存并强制刷新）
  const handleRetry = async () => {
    setShowError(false);
    await handleRefresh();
  };

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
    const waveData = analysisSettings.wave ? analyzeWaves(klineData, analysisSettings.waveSensitivity) : null;

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
        data: volumes.map((v, i) => {
          const isUp = klineData[i].close >= klineData[i].open;
          // 模拟资金流向：放量上涨=主力流入(深红)，缩量上涨=散户流入(浅红)
          // 放量下跌=主力流出(深绿)，缩量下跌=散户流出(浅绿)
          const avgVol = volumes.slice(Math.max(0, i - 5), i).reduce((a, b) => a + b, 0) / Math.min(5, i || 1);
          const isHighVolume = v > avgVol * 1.2;
          let color: string;
          if (isUp) {
            color = isHighVolume ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.4)';
          } else {
            color = isHighVolume ? 'rgba(34,197,94,0.8)' : 'rgba(34,197,94,0.4)';
          }
          return { value: v, itemStyle: { color } };
        }),
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
    if (chanlunData && showAnnotations) {
      // Draw strokes
      chanlunData.strokes.forEach(stroke => {
        if (stroke.start < 0 || stroke.end < 0 || stroke.start >= klineData.length || stroke.end >= klineData.length) return;
        const startPrice = stroke.direction === 'up' ? klineData[stroke.start].low : klineData[stroke.start].high;
        const endPrice = stroke.direction === 'up' ? klineData[stroke.end].high : klineData[stroke.end].low;
        const beforeLen = Math.max(0, stroke.start);
        const betweenLen = Math.max(0, stroke.end - stroke.start - 1);
        series.push({
          type: 'line',
          data: new Array(beforeLen).fill(null).concat([startPrice], new Array(betweenLen).fill(null), [endPrice]),
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

    // Wave labels and connecting lines
    if (waveData && waveData.waves.length > 0 && showAnnotations) {
      // Draw connecting lines between wave pivots
      const wavePoints: Array<{ index: number; price: number; label: string; type: string }> = [];
      waveData.waves.forEach(w => {
        const startPrice = klineData[w.start]?.[w.label === '1' || w.label === '3' || w.label === '5' || w.label === 'B' ? 'low' : 'high'] || 0;
        const endPrice = klineData[w.end]?.[w.label === '2' || w.label === '4' || w.label === 'A' || w.label === 'C' ? 'low' : 'high'] || 0;
        wavePoints.push({ index: w.start, price: startPrice, label: '', type: w.type });
        wavePoints.push({ index: w.end, price: endPrice, label: w.label, type: w.type });
      });

      // Draw wave path line
      if (wavePoints.length >= 2) {
        const waveLineData: Array<[string, number] | null> = [];
        const allDates = dates;
        for (let i = 0; i < allDates.length; i++) waveLineData.push(null);
        wavePoints.forEach((wp, idx) => {
          if (wp.index >= 0 && wp.index < allDates.length) {
            waveLineData[wp.index] = [allDates[wp.index], wp.price];
          }
          // Fill gaps between consecutive wave points
          if (idx > 0) {
            const prevWp = wavePoints[idx - 1];
            const startIdx = Math.min(prevWp.index, wp.index);
            const endIdx = Math.max(prevWp.index, wp.index);
            for (let j = startIdx; j <= endIdx; j++) {
              if (j >= 0 && j < allDates.length && waveLineData[j] === null) {
                const ratio = (j - prevWp.index) / (wp.index - prevWp.index || 1);
                const interpPrice = prevWp.price + (wp.price - prevWp.price) * ratio;
                waveLineData[j] = [allDates[j], interpPrice];
              }
            }
          }
        });

        series.push({
          type: 'line',
          data: waveLineData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          lineStyle: { width: 1.5, color: '#a855f7', type: 'dashed' },
          symbol: 'none',
          z: 6,
          connectNulls: true,
        } as Record<string, unknown>);
      }

      // Draw wave labels
      waveData.waves.forEach(w => {
        const midIndex = Math.floor((w.start + w.end) / 2);
        const midPrice = klineData[midIndex]?.high || 0;
        const isUp = w.label === '1' || w.label === '3' || w.label === '5';
        series.push({
          type: 'scatter',
          data: [[dates[midIndex], midPrice * (isUp ? 1.005 : 0.995)]],
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'circle',
          symbolSize: 18,
          itemStyle: { color: w.type === 'impulse' ? 'rgba(168,85,247,0.2)' : 'rgba(245,158,11,0.2)', borderColor: w.type === 'impulse' ? '#a855f7' : '#f59e0b', borderWidth: 1 },
          z: 10,
          label: { show: true, formatter: w.label, color: w.type === 'impulse' ? '#a855f7' : '#f59e0b', fontSize: 11, fontWeight: 'bold' },
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

      // MACD金叉死叉标记
      const goldenCrossData: Array<[string, number] | null> = [];
      const deathCrossData: Array<[string, number] | null> = [];
      for (let i = 1; i < macdData.length; i++) {
        const prev = macdData[i - 1];
        const curr = macdData[i];
        // 金叉：DIF从下穿上DEA
        if (prev.dif <= prev.dea && curr.dif > curr.dea) {
          goldenCrossData[i] = [dates[i], curr.dif];
        }
        // 死叉：DIF从上穿下DEA
        if (prev.dif >= prev.dea && curr.dif < curr.dea) {
          deathCrossData[i] = [dates[i], curr.dif];
        }
      }
      if (goldenCrossData.some(d => d !== null)) {
        series.push({
          name: 'MACD金叉',
          type: 'scatter',
          data: goldenCrossData,
          xAxisIndex: idx,
          yAxisIndex: idx,
          symbol: 'triangle',
          symbolSize: 8,
          itemStyle: { color: '#ef4444' },
          z: 10,
        } as Record<string, unknown>);
      }
      if (deathCrossData.some(d => d !== null)) {
        series.push({
          name: 'MACD死叉',
          type: 'scatter',
          data: deathCrossData,
          xAxisIndex: idx,
          yAxisIndex: idx,
          symbol: 'triangle',
          symbolSize: 8,
          symbolRotate: 180,
          itemStyle: { color: '#22c55e' },
          z: 10,
        } as Record<string, unknown>);
      }
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
        axisPointer: {
          type: 'cross',
          lineStyle: { color: '#3b82f6', width: 0.5, type: 'dashed' },
          crossStyle: { color: '#3b82f6', width: 0.5, type: 'dashed' },
          label: {
            backgroundColor: '#1e293b',
            color: '#e2e8f0',
            fontSize: 10,
            borderColor: '#3b82f6',
            borderWidth: 1,
          },
        },
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: '#1e293b',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        padding: [8, 12],
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = (params[0] as Record<string, unknown>).dataIndex as number;
          if (idx < 0 || idx >= klineData.length) return '';
          const d = klineData[idx];
          const prevClose = idx > 0 ? klineData[idx - 1].close : d.open;
          const change = d.close - prevClose;
          const changePercent = prevClose ? (change / prevClose * 100) : 0;
          const color = change >= 0 ? '#ef4444' : '#22c55e';
          const sign = change >= 0 ? '+' : '';
          // Store hovered data for external display
          setHoveredData({
            date: d.date, open: d.open, high: d.high, low: d.low, close: d.close,
            volume: d.volume, change, changePercent,
          });
          return `<div style="font-family:monospace;font-size:11px;line-height:1.6">
            <div style="color:#94a3b8;margin-bottom:4px">${d.date}</div>
            <div>开: <span style="color:${d.close >= d.open ? '#ef4444' : '#22c55e'}">${d.open.toFixed(2)}</span></div>
            <div>高: <span style="color:#ef4444">${d.high.toFixed(2)}</span></div>
            <div>低: <span style="color:#22c55e">${d.low.toFixed(2)}</span></div>
            <div>收: <span style="color:${color}">${d.close.toFixed(2)}</span></div>
            <div>涨跌: <span style="color:${color}">${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)</span></div>
            <div>量: <span style="color:#94a3b8">${(d.volume / 10000).toFixed(1)}万</span></div>
          </div>`;
        },
      },
      legend: { show: false },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: xAxes.map((_, i) => i),
          start: 60,
          end: 100,
          minValueSpan: 20, // minimum 20 candles visible
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: 'slider',
          xAxisIndex: xAxes.map((_, i) => i),
          bottom: 5,
          height: 15,
          borderColor: '#1e293b',
          backgroundColor: '#0a0e17',
          fillerColor: 'rgba(59,130,246,0.1)',
          handleStyle: { color: '#3b82f6', borderColor: '#3b82f6' },
          textStyle: { color: '#94a3b8', fontSize: 9 },
          dataBackground: {
            lineStyle: { color: '#1e293b' },
            areaStyle: { color: 'rgba(59,130,246,0.05)' },
          },
        },
      ],
      series: series as echarts.SeriesOption[],
    };

    chart.setOption(option, true);
  }, [klineData, analysisSettings, showAnnotations]);

  useEffect(() => {
    buildChart();
  }, [buildChart]);

  // Listen for dataZoom events to track zoom level
  useEffect(() => {
    if (!chartInstance.current) return;
    const chart = chartInstance.current;
    
    const handleDataZoom = () => {
      const option = chart.getOption();
      const dataZoom = option.dataZoom as Array<{ start: number; end: number }>;
      if (dataZoom && dataZoom[0]) {
        const visiblePercent = Math.round(dataZoom[0].end - dataZoom[0].start);
        setZoomLevel(visiblePercent);
      }
    };

    const handleMouseOut = () => {
      setHoveredData(null);
    };

    chart.on('datazoom', handleDataZoom);
    chart.on('globalout', handleMouseOut);

    return () => {
      chart.off('datazoom', handleDataZoom);
      chart.off('globalout', handleMouseOut);
    };
  }, []);

  // Reset view handler
  const handleResetView = useCallback(() => {
    if (!chartInstance.current) return;
    chartInstance.current.dispatchAction({
      type: 'dataZoom',
      start: 60,
      end: 100,
    });
  }, []);

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
      <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
        请搜索并选择一只股票开始分析
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* 错误提示 Alert */}
      {showError && error && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded px-4 py-2 mx-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-yellow-200">{error.message}</span>
            </div>
            <button
              onClick={handleRetry}
              className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              重试
            </button>
          </div>
          <div className="text-xs text-yellow-300/70 mt-1">{error.suggestion}</div>
        </div>
      )}

      {/* Period selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border-default)]">
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-2 py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
          title="刷新数据"
        >
          {loading ? '⏳' : '🔄'}
        </button>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setKlinePeriod(p.key as typeof klinePeriod)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              klinePeriod === p.key
                ? 'bg-[var(--accent-blue)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          {analysisSettings.ma && analysisSettings.maPeriods.map(p => {
            const colors: Record<number, string> = { 5: '#f59e0b', 10: '#3b82f6', 20: '#a855f7', 60: '#22c55e', 120: '#ef4444', 250: '#94a3b8' };
            return <span key={p} style={{ color: colors[p] }}>MA{p}</span>;
          })}
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${showLegend ? 'bg-[var(--accent-blue)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
          >
            图例
          </button>
          <label className="flex items-center gap-1 cursor-pointer select-none" title="显示/隐藏分析标注">
            <input
              type="checkbox"
              checked={showAnnotations}
              onChange={(e) => setShowAnnotations(e.target.checked)}
              className="w-3 h-3 rounded border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--accent-blue)] focus:ring-0 focus:ring-offset-0 accent-[var(--accent-blue)]"
            />
            <span className="text-[10px] text-[var(--text-secondary)]">标注</span>
          </label>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-1.5 py-0.5 rounded text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            title="刷新数据"
          >
            {loading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {/* Legend overlay */}
      {showLegend && (
        <div className="absolute top-12 right-3 z-20 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded p-3 text-xs shadow-lg max-w-xs">
          <div className="text-[var(--text-secondary)] font-medium mb-2 text-[10px] uppercase tracking-wider">标注图例说明</div>
          <div className="space-y-2">
            {analysisSettings.chanlun && (
              <div>
                <div className="text-[#f59e0b] font-medium mb-1">缠论分析</div>
                <div className="space-y-0.5 text-[10px] pl-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-[#ef4444] inline-block" />
                    <span className="text-[var(--text-primary)]">红色线 = 上升笔（低点→高点）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-[#22c55e] inline-block" />
                    <span className="text-[var(--text-primary)]">绿色线 = 下降笔（高点→低点）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-2 bg-[var(--accent-blue)]/20 border border-[#3b82f6] inline-block" />
                    <span className="text-[var(--text-primary)]">蓝色区域 = 中枢（三笔重叠区间）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#ef4444]">▲</span>
                    <span className="text-[var(--text-primary)]">红色三角+B = 买点（B1一买/B2二买/B3三买）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#22c55e]">▼</span>
                    <span className="text-[var(--text-primary)]">绿色三角+S = 卖点（S1一卖/S2二卖/S3三卖）</span>
                  </div>
                </div>
              </div>
            )}
            {analysisSettings.wave && (
              <div>
                <div className="text-[#a855f7] font-medium mb-1">波浪理论</div>
                <div className="space-y-0.5 text-[10px] pl-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#a855f7] font-bold">1-5</span>
                    <span className="text-[var(--text-primary)]">推动浪（5浪结构，1/3/5顺势，2/4回调）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#f59e0b] font-bold">A-C</span>
                    <span className="text-[var(--text-primary)]">调整浪（3浪结构，A/C顺势，B反弹）</span>
                  </div>
                  <div className="text-[var(--text-secondary)] text-[9px] mt-0.5">浪型标注在每段波动的中点位置</div>
                </div>
              </div>
            )}
            {analysisSettings.boll && (
              <div>
                <div className="text-[#3b82f6] font-medium mb-1">布林带 (BOLL)</div>
                <div className="space-y-0.5 text-[10px] pl-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-[var(--accent-blue)] inline-block" style={{ borderStyle: 'dashed' }} />
                    <span className="text-[var(--text-primary)]">上轨/中轨/下轨 = 价格波动通道</span>
                  </div>
                </div>
              </div>
            )}
            {analysisSettings.ma && (
              <div>
                <div className="text-[#f59e0b] font-medium mb-1">均线系统 (MA)</div>
                <div className="space-y-0.5 text-[10px] pl-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-[#f59e0b] inline-block" />
                    <span className="text-[var(--text-primary)]">MA5/MA10 = 短期趋势</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-[var(--accent-blue)] inline-block" />
                    <span className="text-[var(--text-primary)]">MA20/MA60 = 中期趋势</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-[#94a3b8] inline-block" />
                    <span className="text-[var(--text-primary)]">MA120/MA250 = 长期趋势（半年线/年线）</span>
                  </div>
                </div>
              </div>
            )}
            {!analysisSettings.chanlun && !analysisSettings.wave && !analysisSettings.boll && !analysisSettings.ma && (
              <div className="text-[var(--text-secondary)] text-[10px]">暂无开启的分析指标，请在右侧面板开启</div>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0 relative">
        <div ref={chartRef} className="absolute inset-0" />
        
        {/* Hovered K-line data overlay (top-left) */}
        {hoveredData && (
          <div className="absolute top-2 left-16 z-10 pointer-events-none">
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-[var(--text-secondary)]">{hoveredData.date}</span>
              <span>开:<span className={hoveredData.close >= hoveredData.open ? 'text-[#ef4444]' : 'text-[#22c55e]'}>{hoveredData.open.toFixed(2)}</span></span>
              <span>高:<span className="text-[#ef4444]">{hoveredData.high.toFixed(2)}</span></span>
              <span>低:<span className="text-[#22c55e]">{hoveredData.low.toFixed(2)}</span></span>
              <span>收:<span className={hoveredData.close >= hoveredData.open ? 'text-[#ef4444]' : 'text-[#22c55e]'}>{hoveredData.close.toFixed(2)}</span></span>
              <span className={hoveredData.change >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}>
                {hoveredData.change >= 0 ? '+' : ''}{hoveredData.change.toFixed(2)} ({hoveredData.changePercent >= 0 ? '+' : ''}{hoveredData.changePercent.toFixed(2)}%)
              </span>
              <span className="text-[var(--text-secondary)]">量:{(hoveredData.volume / 10000).toFixed(1)}万</span>
            </div>
          </div>
        )}

        {/* Zoom indicator (bottom-right) */}
        <div className="absolute bottom-8 right-10 z-10 flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-secondary)] font-mono">{zoomLevel}%</span>
          {zoomLevel < 100 && (
            <button
              onClick={handleResetView}
              className="px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-panel)]/80 border border-[var(--border-default)] rounded transition-colors"
              title="重置视图"
            >
              重置
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
