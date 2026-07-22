/**
 * BacktestChart - K线图 + 买卖点标注
 * 悬停标记时，下方文本栏展示交易依据
 */
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import type { KLineData } from '@/lib/types';
import type { StrategyType } from '@/lib/backtest-engine';
import type { TradeReasoning } from './backtest-session-storage';

// ============ 类型定义 ============

interface BacktestTrade {
  date: string;
  type: 'buy' | 'sell';
  price: number;
  shares: number;
  amount: number;
  commission: number;
  strategy: StrategyType;
  reasoning?: TradeReasoning;
}

interface BacktestChartProps {
  klineData: KLineData[];
  trades: BacktestTrade[];
  title?: string;
}

// ============ 策略标签映射 ============

const STRATEGY_LABELS: Record<string, string> = {
  macd_golden_cross: 'MACD金叉',
  macd_death_cross: 'MACD死叉',
  kdj_oversold: 'KDJ超卖',
  kdj_overbought: 'KDJ超买',
  rsi_oversold: 'RSI超卖',
  rsi_overbought: 'RSI超买',
  boll_lower_touch: '布林下轨',
  boll_upper_touch: '布林上轨',
  ma_golden_cross: '均线金叉',
  ma_death_cross: '均线死叉',
  chanlun_buy: '缠论买点',
  chanlun_sell: '缠论卖点',
  wave_buy: '波浪买点',
  wave_sell: '波浪卖点',
  composite_buy: '综合买入',
  composite_sell: '综合卖出',
};

// ============ 主组件 ============

export default function BacktestChart({ klineData, trades, title }: BacktestChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [hoveredTrade, setHoveredTrade] = useState<BacktestTrade | null>(null);
  const [clickedTrade, setClickedTrade] = useState<BacktestTrade | null>(null);

  // 当前显示的交易（点击锁定优先，否则显示悬停）
  const displayTrade = clickedTrade || hoveredTrade;

  // 用 ref 存储事件处理器，避免状态变化触发图表重绘
  const handlersRef = useRef({
    onMarkOver: null as ((params: Record<string, unknown>) => void) | null,
    onMarkOut: null as (() => void) | null,
    onMarkClick: null as ((params: Record<string, unknown>) => void) | null,
  });

  // 标记悬停事件处理（仅在未锁定时更新）
  const handleMarkOver = useCallback((params: Record<string, unknown>) => {
    if (clickedTrade) return; // 已锁定时忽略悬停
    try {
      const val = params.value;
      if (typeof val === 'string') {
        const trade: BacktestTrade = JSON.parse(val);
        setHoveredTrade(trade);
      }
    } catch {
      // ignore parse error
    }
  }, [clickedTrade]);

  const handleMarkOut = useCallback(() => {
    if (clickedTrade) return; // 已锁定时忽略离开
    setHoveredTrade(null);
  }, [clickedTrade]);

  // 标记点击事件处理（锁定/切换/取消）
  const handleMarkClick = useCallback((params: Record<string, unknown>) => {
    try {
      const val = params.value;
      if (typeof val === 'string') {
        const trade: BacktestTrade = JSON.parse(val);
        // 点击同一标记：取消锁定；点击不同标记：切换锁定
        setClickedTrade(prev => (prev?.date === trade.date && prev?.type === trade.type) ? null : trade);
      }
    } catch {
      // ignore parse error
    }
  }, []);

  // 点击图表外部取消锁定
  const handleChartClickOutside = useCallback(() => {
    setClickedTrade(null);
  }, []);

  // 同步 handler 到 ref
  useEffect(() => {
    handlersRef.current = { onMarkOver: handleMarkOver, onMarkOut: handleMarkOut, onMarkClick: handleMarkClick };
  }, [handleMarkOver, handleMarkOut, handleMarkClick]);

  useEffect(() => {
    if (!chartRef.current) return;

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
          const p = params as Array<{ data?: number[]; axisValue?: string }>;
          const k = p[0];
          if (!k || !k.data) return '';
          const [open, close, low, high] = k.data;
          const date = k.axisValue || '';
          const change = close - open;
          const changePct = ((change / open) * 100).toFixed(2);
          const color = change >= 0 ? '#ef4444' : '#22c55e';

          // 查找当天的交易（仅显示简短提示）
          const dayTrades = trades.filter(t => {
            const nd = t.date.replace(/\//g, '-');
            return nd === date || t.date === date;
          });

          let tradeHint = '';
          if (dayTrades.length > 0) {
            for (const trade of dayTrades) {
              const dir = trade.type === 'buy' ? '买入' : '卖出';
              const tColor = trade.type === 'buy' ? '#ef4444' : '#22c55e';
              tradeHint += `<div style="margin-top:3px;color:${tColor};font-size:11px">${dir} ${trade.shares}股 @ ¥${trade.price.toFixed(2)}<span style="color:#64748b;margin-left:4px">↓ 见下方依据</span></div>`;
            }
          }

          return `
            <div style="font-weight:600;margin-bottom:4px">${date}</div>
            <div>开: <span style="color:${color}">${open.toFixed(2)}</span> 高: <span style="color:${color}">${high.toFixed(2)}</span></div>
            <div>低: <span style="color:${color}">${low.toFixed(2)}</span> 收: <span style="color:${color}">${close.toFixed(2)}</span></div>
            <div>涨跌: <span style="color:${color}">${change >= 0 ? '+' : ''}${change.toFixed(2)} (${change >= 0 ? '+' : ''}${changePct}%)</span></div>
            ${tradeHint}
          `;
        },
      },
      // 缩放和拖拽配置
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
          bottom: 10,
          height: 20,
          borderColor: '#334155',
          fillerColor: 'rgba(59, 130, 246, 0.2)',
          handleStyle: { color: '#3b82f6', borderColor: '#60a5fa' },
          textStyle: { color: '#94a3b8', fontSize: 10 },
        },
      ],
      grid: [
        { left: 60, right: 20, top: 30, height: '55%' },
        { left: 60, right: 20, top: '72%', height: '18%' },
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
          splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
        },
        {
          scale: true,
          gridIndex: 1,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
          splitLine: { show: false },
        },
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
            symbol: 'triangle',
            label: { show: false },
            data: markers,
            tooltip: { formatter: () => '' },
          },
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumes.map((v, i) => ({
            value: v,
            itemStyle: {
              color: ohlc[i][1] >= ohlc[i][0] ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)',
            },
          })),
          xAxisIndex: 1,
          yAxisIndex: 1,
        },
      ],
    };

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);

      // 绑定标记悬停事件（使用 ref，始终指向最新 handler）
      chartInstance.current.on('mouseover', { seriesIndex: 0 }, (params: Record<string, unknown>) => {
        if (params.componentType === 'markPoint') {
          handlersRef.current.onMarkOver?.(params);
        }
      });
      chartInstance.current.on('mouseout', { seriesIndex: 0 }, (params: Record<string, unknown>) => {
        if (params.componentType === 'markPoint') {
          handlersRef.current.onMarkOut?.();
        }
      });

      // 使用 chart.on('click') 检测 markPoint 点击，不干扰 dataZoom
      const handleChartClick = (params: Record<string, unknown>) => {
        if (params.componentType === 'markPoint' && params.data) {
          handlersRef.current.onMarkClick?.(params as Record<string, unknown>);
        }
      };
      chartInstance.current.on('click', { seriesIndex: 0 }, handleChartClick);
    } else {
      // 数据更新时先清空，避免 dataZoom 状态残留
      chartInstance.current.clear();
    }

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [klineData, trades]);

  const strategyName = displayTrade ? (STRATEGY_LABELS[displayTrade.strategy] || displayTrade.strategy) : '';

  return (
    <div onClick={handleChartClickOutside}>
      {/* K线图区域 */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <div ref={chartRef} style={{ width: '100%', height: 400 }} />

        {/* 图例 */}
        <div className="absolute top-2 right-2 flex gap-3 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-0.5">
            <span className="inline-block w-2 h-2 bg-up rounded-full" />买入
          </span>
          <span className="flex items-center gap-0.5">
            <span className="inline-block w-2 h-2 bg-down rounded-full" />卖出
          </span>
        </div>

        {/* 标题 */}
        {title && (
          <div className="absolute top-2 left-2 text-xs font-medium text-[var(--text-primary)]">
            {title}
          </div>
        )}

        {/* 锁定提示 */}
        {clickedTrade && (
          <div className="absolute top-2 right-20 text-[10px] text-[var(--text-muted)] flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            已锁定 · 点击标记切换 · 点击外部取消
          </div>
        )}
      </div>

      {/* 交易依据文本栏 */}
      <div
        className="mt-1 border border-[var(--border)] rounded bg-[var(--bg-panel)] overflow-auto select-text"
        style={{ height: 140 }}
      >
        {displayTrade ? (
          <div className="p-3 space-y-2">
            {/* 第一行：方向 + 日期 + 策略 */}
            <div className="flex items-center gap-3">
              <span
                className="text-sm font-bold px-2 py-0.5 rounded"
                style={{
                  color: displayTrade.type === 'buy' ? '#ef4444' : '#22c55e',
                  backgroundColor: displayTrade.type === 'buy' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                }}
              >
                {displayTrade.type === 'buy' ? '▲ 买入' : '▼ 卖出'}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{displayTrade.date}</span>
              <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-page)] px-1.5 py-0.5 rounded">
                {strategyName}
              </span>
              {clickedTrade && (
                <span className="text-[10px] text-[var(--accent)] ml-auto"> 已锁定</span>
              )}
            </div>

            {/* 第二行：交易数据 */}
            <div className="flex gap-4 text-xs">
              <span className="text-[var(--text-muted)]">
                价格 <span className="text-[var(--text-primary)] font-mono-num">¥{displayTrade.price.toFixed(2)}</span>
              </span>
              <span className="text-[var(--text-muted)]">
                数量 <span className="text-[var(--text-primary)] font-mono-num">{displayTrade.shares}股</span>
              </span>
              <span className="text-[var(--text-muted)]">
                金额 <span className="text-[var(--text-primary)] font-mono-num">¥{displayTrade.amount.toFixed(0)}</span>
              </span>
            </div>

            {/* 依据描述 */}
            {displayTrade.reasoning?.description && (
              <div className="border-t border-[var(--border-subtle)] pt-2">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">交易依据</div>
                <div className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {displayTrade.reasoning.description}
                </div>
              </div>
            )}

            {/* 无依据 */}
            {!displayTrade.reasoning?.description && (
              <div className="border-t border-[var(--border-subtle)] pt-2">
                <div className="text-xs text-[var(--text-muted)]">暂无详细交易依据</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
            将鼠标悬停在 K 线图的买卖点标记上查看交易依据 · 点击标记可锁定
          </div>
        )}
      </div>
    </div>
  );
}
