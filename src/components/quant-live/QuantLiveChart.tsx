/**
 * QuantLiveChart - 量化实时账户 K 线图 + 买卖标注
 * 基于 ECharts，复用 BacktestChart 逻辑
 */
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';

// ============ 类型定义 ============

export interface QuantLiveTrade {
  id?: string;
  date: string;
  type: 'buy' | 'sell';
  price: number;
  shares: number;
  amount: number;
  strategy?: string;
  reasons?: string[];
  created_at?: string;
}

export interface KLineDataPoint {
  date: string;
  open: number;
  close: number;
  low: number;
  high: number;
  volume: number;
}

interface QuantLiveChartProps {
  klineData: KLineDataPoint[];
  trades: QuantLiveTrade[];
  stockCode?: string;
  stockName?: string;
  height?: number;
}

// ============ 策略标签映射 ============

const STRATEGY_LABELS: Record<string, string> = {
  macd_golden_cross: 'MACD 金叉',
  macd_death_cross: 'MACD 死叉',
  kdj_oversold: 'KDJ 超卖',
  kdj_overbought: 'KDJ 超买',
  rsi_oversold: 'RSI 超卖',
  rsi_overbought: 'RSI 超买',
  boll_lower_touch: '布林下轨',
  boll_upper_touch: '布林上轨',
  ma_golden_cross: '均线金叉',
  ma_death_cross: '均线死叉',
};

// ============ 主组件 ============

export default function QuantLiveChart({ 
  klineData, 
  trades, 
  stockCode, 
  stockName,
  height = 500 
}: QuantLiveChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [hoveredTrade, setHoveredTrade] = useState<QuantLiveTrade | null>(null);

  // 标记悬停事件处理
  const handleMarkOver = useCallback((params: Record<string, unknown>) => {
    try {
      const val = params.value;
      if (typeof val === 'string') {
        const trade: QuantLiveTrade = JSON.parse(val);
        setHoveredTrade(trade);
      }
    } catch {
      // ignore parse error
    }
  }, []);

  useEffect(() => {
    if (!chartRef.current || klineData.length === 0) return;

    // 初始化图表
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // 排序数据
    const sortedData = [...klineData].sort((a, b) => a.date.localeCompare(b.date));
    const dates = sortedData.map(d => d.date);
    const ohlc = sortedData.map(d => [d.open, d.close, d.low, d.high]);
    const volumes = sortedData.map(d => d.volume);

    // 建立日期到索引的映射
    const dateIndexMap = new Map<string, number>();
    dates.forEach((date, idx) => {
      const normalized = date.replace(/\//g, '-');
      dateIndexMap.set(normalized, idx);
      dateIndexMap.set(date, idx);
    });

    // 生成买卖点标记
    const markers: Array<Record<string, unknown>> = [];

    for (const trade of trades) {
      const normalizedDate = trade.date.replace(/\//g, '-');
      const idx = dateIndexMap.get(normalizedDate) ?? dateIndexMap.get(trade.date);
      if (idx === undefined) continue;

      const kline = sortedData[idx];
      const markerDate = dates[idx];

      if (trade.type === 'buy') {
        markers.push({
          name: '买入',
          coord: [markerDate, kline.low * 0.95],
          value: JSON.stringify(trade),
          symbol: 'triangle',
          symbolSize: 16,
          itemStyle: {
            color: '#ef4444',
            borderColor: '#ffffff',
            borderWidth: 1.5,
          },
        });
      } else {
        markers.push({
          name: '卖出',
          coord: [markerDate, kline.high * 1.05],
          value: JSON.stringify(trade),
          symbol: 'pin',
          symbolSize: 18,
          symbolRotate: 180,
          itemStyle: {
            color: '#22c55e',
            borderColor: '#ffffff',
            borderWidth: 1.5,
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
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (params: unknown) => {
          const arr = (Array.isArray(params) ? params : [params]) as Array<{ data?: number[]; axisValue?: string }>;
          const k = arr[0];
          if (!k || !k.data) return '';
          const [open, close, low, high] = k.data;
          const date = k.axisValue || '';
          const change = close - open;
          const changePct = ((change / open) * 100).toFixed(2);
          const color = change >= 0 ? '#ef4444' : '#22c55e';

          return `
            <div style="padding: 8px; font-family: monospace;">
              <div style="font-weight: bold; margin-bottom: 6px;">${date}</div>
              <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 11px;">
                <span style="color: #94a3b8;">开盘</span><span>${open.toFixed(2)}</span>
                <span style="color: #94a3b8;">收盘</span><span style="color: ${color};">${close.toFixed(2)}</span>
                <span style="color: #94a3b8;">最低</span><span>${low.toFixed(2)}</span>
                <span style="color: #94a3b8;">最高</span><span>${high.toFixed(2)}</span>
                <span style="color: #94a3b8;">涨跌</span><span style="color: ${color};">${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct}%)</span>
              </div>
            </div>
          `;
        },
      },
      grid: [
        { left: '8%', right: '8%', top: '8%', height: '60%' },
        { left: '8%', right: '8%', top: '75%', height: '15%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          gridIndex: 0,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
          splitLine: { show: false },
        },
        {
          type: 'category',
          data: dates,
          gridIndex: 1,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          scale: true,
          gridIndex: 0,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1e293b' } },
        },
        {
          scale: true,
          gridIndex: 1,
          axisLine: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 70,
          end: 100,
        },
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          bottom: 10,
          height: 20,
          borderColor: '#334155',
          fillerColor: 'rgba(59, 130, 246, 0.2)',
          handleStyle: { color: '#3b82f6' },
          textStyle: { color: '#94a3b8' },
        },
      ],
      series: [
        {
          name: 'K 线',
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: '#ef4444',
            color0: '#22c55e',
            borderColor: '#ef4444',
            borderColor0: '#22c55e',
          },
          markPoint: {
            data: markers,
            animation: false,
            label: { show: false },
          },
        },
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes,
          itemStyle: {
            color: (params: Record<string, unknown>) => {
              const idx = params.dataIndex as number;
              const isUp = sortedData[idx].close >= sortedData[idx].open;
              return isUp ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)';
            },
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    // 绑定标记悬停事件
    chartInstance.current.on('mouseover', { seriesIndex: 0 }, (params: Record<string, unknown>) => {
      if (params.componentType === 'markPoint') {
        handleMarkOver(params);
      }
    });

    // 响应式
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [klineData, trades, handleMarkOver]);

  // 获取策略标签
  const getStrategyLabel = (strategy?: string) => {
    if (!strategy) return '未知策略';
    return STRATEGY_LABELS[strategy] || strategy;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 标题 */}
      {(stockCode || stockName) && (
        <div className="flex items-center gap-2 px-2">
          <span className="text-sm font-bold text-slate-200">
            {stockName || stockCode}
          </span>
          {stockCode && (
            <span className="text-xs text-slate-500 font-mono">{stockCode}</span>
          )}
        </div>
      )}

      {/* 图表 */}
      <div 
        ref={chartRef} 
        style={{ height: `${height}px`, width: '100%' }}
        className="bg-slate-900/50 rounded border border-slate-800"
      />

      {/* 底部文本栏 - 显示悬停的交易详情 */}
      {hoveredTrade && (
        <div className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-xs font-mono">
          <div className="flex items-center gap-3 mb-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              hoveredTrade.type === 'buy' 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-green-500/20 text-green-400'
            }`}>
              {hoveredTrade.type === 'buy' ? '买入' : '卖出'}
            </span>
            <span className="text-slate-400">{hoveredTrade.date}</span>
            <span className="text-slate-300">价格：{hoveredTrade.price.toFixed(2)}</span>
            <span className="text-slate-400">数量：{hoveredTrade.shares}股</span>
            <span className="text-slate-400">金额：{hoveredTrade.amount.toFixed(2)}</span>
          </div>
          {hoveredTrade.strategy && (
            <div className="text-slate-500">
              策略：{getStrategyLabel(hoveredTrade.strategy)}
            </div>
          )}
          {hoveredTrade.reasons && hoveredTrade.reasons.length > 0 && (
            <div className="text-slate-500 mt-1">
              依据：{hoveredTrade.reasons.join('、')}
            </div>
          )}
        </div>
      )}

      {/* 图例说明 */}
      <div className="flex items-center gap-4 px-2 text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
          <span>买入标记</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-full" />
          <span>卖出标记</span>
        </div>
        <div className="ml-auto text-slate-600">
          提示：悬停标记查看交易详情
        </div>
      </div>
    </div>
  );
}
