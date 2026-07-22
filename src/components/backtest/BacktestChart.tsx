/**
 * BacktestChart - K线图 + 买卖点标注 + 交互
 * 悬停标记显示摘要，点击标记显示详情卡片
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
  onTradeClick?: (tradeIndex: number) => void;
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

// ============ 构建悬停摘要 ============

function buildHoverSummary(trade: BacktestTrade): string {
  const direction = trade.type === 'buy' ? '买入' : '卖出';
  const color = trade.type === 'buy' ? '#ef4444' : '#22c55e';
  const strategyName = STRATEGY_LABELS[trade.strategy] || trade.strategy;
  
  let html = `<div style="font-size:14px;font-weight:600;color:${color};margin-bottom:4px">${direction} ${trade.date}</div>`;
  html += `<div style="font-size:12px;color:#94a3b8">策略: ${strategyName}</div>`;
  html += `<div style="font-size:12px;color:#94a3b8">价格: ¥${trade.price.toFixed(2)}</div>`;
  html += `<div style="font-size:11px;color:#64748b;margin-top:4px">点击查看详情</div>`;
  
  return html;
}

// ============ 主组件 ============

export default function BacktestChart({ klineData, trades, title }: BacktestChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<BacktestTrade | null>(null);

  // 点击标记外部关闭详情卡片
  const handleCloseDetail = useCallback(() => {
    setSelectedTrade(null);
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    // 排序数据
    const sortedData = [...klineData].sort((a, b) => a.date.localeCompare(b.date));
    const dates = sortedData.map(d => d.date);
    const ohlc = sortedData.map(d => [d.open, d.close, d.low, d.high]);
    const volumes = sortedData.map(d => d.volume);

    // 建立日期到索引的映射（使用标准化日期）
    const dateIndexMap = new Map<string, number>();
    dates.forEach((date, idx) => {
      const normalized = date.replace(/\//g, '-');
      dateIndexMap.set(normalized, idx);
      dateIndexMap.set(date, idx);
    });

    // 生成买卖点标记
    const buyMarkers: any[] = [];
    const sellMarkers: any[] = [];

    for (const trade of trades) {
      const normalizedDate = trade.date.replace(/\//g, '-');
      const idx = dateIndexMap.get(normalizedDate) ?? dateIndexMap.get(trade.date);
      if (idx === undefined) continue;

      const kline = sortedData[idx];
      const markerDate = dates[idx];

      if (trade.type === 'buy') {
        buyMarkers.push({
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
        sellMarkers.push({
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

    const option: echarts.EChartsOption = {
      animation: false,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (params: any) => {
          const k = params[0];
          if (!k || !k.data) return '';
          const [open, close, low, high] = k.data;
          const date = k.axisValue;
          const change = close - open;
          const changePct = ((change / open) * 100).toFixed(2);
          const color = change >= 0 ? '#ef4444' : '#22c55e';
          
          // 查找当天的交易
          const dayTrades = trades.filter(t => {
            const normalizedTradeDate = t.date.replace(/\//g, '-');
            return normalizedTradeDate === date || t.date === date;
          });
          
          let tradeInfo = '';
          if (dayTrades.length > 0) {
            for (const trade of dayTrades) {
              const dir = trade.type === 'buy' ? '买入' : '卖出';
              const tColor = trade.type === 'buy' ? '#ef4444' : '#22c55e';
              const strategyName = STRATEGY_LABELS[trade.strategy] || trade.strategy;
              tradeInfo += `<div style="margin-top:4px;padding-top:4px;border-top:1px solid #334155">
                <span style="color:${tColor};font-weight:600">${dir}</span> 
                <span style="color:#94a3b8">${strategyName}</span>
                <span style="color:#e2e8f0;margin-left:8px">¥${trade.price.toFixed(2)} × ${trade.shares}股</span>
              </div>`;
            }
          }
          
          return `
            <div style="font-weight:600;margin-bottom:4px">${date}</div>
            <div>开: <span style="color:${color}">${open.toFixed(2)}</span> 高: <span style="color:${color}">${high.toFixed(2)}</span></div>
            <div>低: <span style="color:${color}">${low.toFixed(2)}</span> 收: <span style="color:${color}">${close.toFixed(2)}</span></div>
            <div>涨跌: <span style="color:${color}">${change >= 0 ? '+' : ''}${change.toFixed(2)} (${change >= 0 ? '+' : ''}${changePct}%)</span></div>
            ${tradeInfo}
          `;
        },
      },
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
            data: [...buyMarkers, ...sellMarkers],
            tooltip: {
              formatter: (params: any) => {
                try {
                  const trade: BacktestTrade = JSON.parse(params.value);
                  return buildHoverSummary(trade);
                } catch {
                  return params.name || '';
                }
              },
            },
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
      
      // 绑定点击事件处理标记点击
      chartInstance.current.on('click', 'series.markPoint', (params: any) => {
        try {
          const trade: BacktestTrade = JSON.parse(params.value);
          setSelectedTrade(trade);
        } catch {
          // ignore
        }
      });
    }

    chartInstance.current.setOption(option, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [klineData, trades]);

  // 获取选中交易的详情信息
  const getTradeDetailInfo = (trade: BacktestTrade) => {
    const direction = trade.type === 'buy' ? '买入' : '卖出';
    const color = trade.type === 'buy' ? '#ef4444' : '#22c55e';
    const strategyName = STRATEGY_LABELS[trade.strategy] || trade.strategy;
    
    return { direction, color, strategyName };
  };

  return (
    <div className="relative" onClick={(e) => {
      // 点击卡片外部关闭详情
      if (selectedTrade && !(e.target as HTMLElement).closest('.trade-detail-card')) {
        handleCloseDetail();
      }
    }}>
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

      {/* 点击标记后的详情卡片 */}
      {selectedTrade && (
        <div 
          className="trade-detail-card absolute top-10 right-4 w-72 bg-[var(--bg-panel)] border border-[var(--border)] rounded shadow-lg z-50"
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const { direction, color, strategyName } = getTradeDetailInfo(selectedTrade);
            return (
              <>
                {/* 头部 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-sm font-bold"
                      style={{ color }}
                    >
                      {selectedTrade.type === 'buy' ? '▲' : '▼'} {direction}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {selectedTrade.date}
                    </span>
                  </div>
                  <button 
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
                    onClick={handleCloseDetail}
                  >
                    ✕
                  </button>
                </div>

                {/* 交易信息 */}
                <div className="px-3 py-2 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">价格</span>
                    <span className="text-[var(--text-primary)] font-mono-num">¥{selectedTrade.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">数量</span>
                    <span className="text-[var(--text-primary)] font-mono-num">{selectedTrade.shares}股</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">金额</span>
                    <span className="text-[var(--text-primary)] font-mono-num">¥{selectedTrade.amount.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">手续费</span>
                    <span className="text-[var(--text-primary)] font-mono-num">¥{selectedTrade.commission.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">策略</span>
                    <span className="text-[var(--text-primary)]">{strategyName}</span>
                  </div>
                </div>

                {/* 买卖依据 */}
                {selectedTrade.reasoning && (
                  <div className="px-3 py-2 border-t border-[var(--border-subtle)]">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      交易依据
                    </div>
                    
                    {/* 规则描述 */}
                    {selectedTrade.reasoning.description && (
                      <div className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
                        {selectedTrade.reasoning.description}
                      </div>
                    )}

                    {/* 指标快照 */}
                    <div className="space-y-1">
                      {selectedTrade.reasoning.indicatorSnapshot.macd && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-muted)]">MACD</span>
                          <span className="font-mono-num text-[var(--text-secondary)]">
                            DIF={selectedTrade.reasoning.indicatorSnapshot.macd.dif.toFixed(3)} 
                            DEA={selectedTrade.reasoning.indicatorSnapshot.macd.dea.toFixed(3)}
                          </span>
                        </div>
                      )}
                      {selectedTrade.reasoning.indicatorSnapshot.kdj && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-muted)]">KDJ</span>
                          <span className="font-mono-num text-[var(--text-secondary)]">
                            K={selectedTrade.reasoning.indicatorSnapshot.kdj.k.toFixed(1)} 
                            D={selectedTrade.reasoning.indicatorSnapshot.kdj.d.toFixed(1)} 
                            J={selectedTrade.reasoning.indicatorSnapshot.kdj.j.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {selectedTrade.reasoning.indicatorSnapshot.rsi !== undefined && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-muted)]">RSI</span>
                          <span className="font-mono-num text-[var(--text-secondary)]">
                            {selectedTrade.reasoning.indicatorSnapshot.rsi.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {selectedTrade.reasoning.indicatorSnapshot.boll && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-muted)]">BOLL</span>
                          <span className="font-mono-num text-[var(--text-secondary)]">
                            {selectedTrade.reasoning.indicatorSnapshot.boll.lower.toFixed(2)} / {selectedTrade.reasoning.indicatorSnapshot.boll.upper.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {selectedTrade.reasoning.indicatorSnapshot.ma && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-muted)]">MA</span>
                          <span className="font-mono-num text-[var(--text-secondary)]">
                            MA5={selectedTrade.reasoning.indicatorSnapshot.ma.ma5.toFixed(2)} 
                            MA20={selectedTrade.reasoning.indicatorSnapshot.ma.ma20.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 无依据提示 */}
                {!selectedTrade.reasoning && (
                  <div className="px-3 py-2 border-t border-[var(--border-subtle)]">
                    <div className="text-[10px] text-[var(--text-muted)]">
                      暂无交易依据数据
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
