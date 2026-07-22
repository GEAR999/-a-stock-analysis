'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { KLineData } from '@/lib/types';
import type { BacktestTrade } from '@/lib/backtest-engine';

interface BacktestChartProps {
  klineData: KLineData[];
  trades: BacktestTrade[];
  onTradeClick?: (tradeIdx: number) => void;
}

export function BacktestChart({ klineData, trades, onTradeClick }: BacktestChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; trade: BacktestTrade; idx: number;
  } | null>(null);

  useEffect(() => {
    if (!chartRef.current || klineData.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    }

    const chart = chartInstance.current;
    // 按日期升序排序，确保时间轴从左到右是旧数据到新数据
    const sortedData = [...klineData].sort((a, b) => a.date.localeCompare(b.date));
    const dates = sortedData.map(d => d.date);
    const ohlc = sortedData.map(d => [d.open, d.close, d.low, d.high]);
    const volumes = sortedData.map(d => d.volume);

    // 生成买卖点标记
    const buyMarkers: Record<string, unknown>[] = [];
    const sellMarkers: Record<string, unknown>[] = [];

    // 日期标准化函数：将日期统一为 YYYY-MM-DD 格式进行比较
    const normalizeDate = (dateStr: string): string => {
      if (!dateStr) return '';
      // 处理 YYYY-MM-DD 格式
      const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match) {
        const [, year, month, day] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      // 处理 YYYY/MM/DD 格式
      const match2 = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      if (match2) {
        const [, year, month, day] = match2;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return dateStr;
    };

    // 建立日期到索引的映射（使用标准化后的日期）
    const dateIndexMap = new Map<string, number>();
    dates.forEach((date, idx) => {
      dateIndexMap.set(normalizeDate(date), idx);
    });

    for (const trade of trades) {
      const normalizedTradeDate = normalizeDate(trade.date);
      const idx = dateIndexMap.get(normalizedTradeDate);
      if (idx === undefined) continue;
      const kline = sortedData[idx];
      // 使用 dates[idx] 确保标记的 x 轴值与 x 轴数据完全一致
      const markerDate = dates[idx];
      if (trade.type === 'buy') {
        buyMarkers.push({
          name: '买入',
          coord: [markerDate, kline.low * 0.95],
          symbol: 'triangle',
          symbolSize: 16,
          itemStyle: { 
            color: '#ef4444',
            borderColor: '#ffffff',
            borderWidth: 1.5
          },
        });
      } else {
        sellMarkers.push({
          name: '卖出',
          coord: [markerDate, kline.high * 1.05],
          symbol: 'pin',
          symbolSize: 18,
          symbolRotate: 180,
          itemStyle: { 
            color: '#22c55e',
            borderColor: '#ffffff',
            borderWidth: 1.5
          },
        });
      }
    }

    const option = {
      animation: false,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e2e8f0', fontSize: 10 },
      },
      grid: [
        { left: 40, right: 10, top: 10, height: '55%' },
        { left: 40, right: 10, top: '72%', height: '18%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          gridIndex: 0,
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          axisLabel: { color: '#94a3b8', fontSize: 9 },
          splitLine: { show: false },
        },
        {
          type: 'category',
          data: dates,
          gridIndex: 1,
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          scale: true,
          gridIndex: 0,
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          axisLabel: { color: '#94a3b8', fontSize: 9 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        },
        {
          scale: true,
          gridIndex: 1,
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: 60, end: 100 },
        { type: 'slider', xAxisIndex: [0, 1], bottom: 2, height: 12, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.05)', fillerColor: 'rgba(59,130,246,0.15)', handleStyle: { color: '#3b82f6' }, textStyle: { color: '#94a3b8', fontSize: 8 } },
      ],
      series: [
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
          markPoint: {
            data: [...buyMarkers, ...sellMarkers],
            animation: false,
          },
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumes.map((v, i) => ({
            value: v,
            itemStyle: {
              color: klineData[i].close >= klineData[i].open
                ? 'rgba(239, 68, 68, 0.5)'
                : 'rgba(34, 197, 94, 0.5)',
            },
          })),
          xAxisIndex: 1,
          yAxisIndex: 1,
        },
      ],
    };

    chart.setOption(option);

    // 点击事件
    chart.off('click');
    chart.on('click', (params: Record<string, unknown>) => {
      if (params.componentType === 'markPoint' || params.seriesName === 'K线') {
        const date = (params as { name?: string; value?: string[] }).name || ((params as { value?: string[] }).value?.[0]);
        if (date) {
          const tradeIdx = trades.findIndex(t => t.date === date);
          if (tradeIdx >= 0) {
            onTradeClick?.(tradeIdx);
          }
        }
      }
    });

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [klineData, trades, onTradeClick]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (klineData.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-text-secondary text-xs">
        无K线数据
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={chartRef} className="w-full h-48" />
      {/* 图例 */}
      <div className="absolute top-1 right-1 flex items-center gap-2 text-[9px] text-text-secondary">
        <span className="flex items-center gap-0.5">
          <span className="inline-block w-2 h-2 bg-up rounded-full" />买入
        </span>
        <span className="flex items-center gap-0.5">
          <span className="inline-block w-2 h-2 bg-down rounded-full" />卖出
        </span>
      </div>
    </div>
  );
}
