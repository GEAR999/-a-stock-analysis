'use client';

import { useState, useCallback } from 'react';
import { Play, Square, Download, Settings, TrendingUp, TrendingDown, BarChart3, Search, X, Loader2, Save, FileText } from 'lucide-react';
import { runBacktest, type BacktestConfig, type BacktestResult, type BacktestTrade, type StrategyType } from '@/lib/backtest-engine';
import type { KLineData } from '@/lib/types';
import { fetchKLineData as fetchFromDataSource } from '@/lib/data-source';
import { getAllStrategies, type StrategyDefinition } from '@/lib/strategy-library';
import BacktestChart from './BacktestChart';
import { batchGenerateReasoning, type ReasoningResult, type KLineSnapshot, type IndicatorSnapshot } from '@/lib/backtest-reasoning';
import { calcMACD, calcKDJ, calcRSI, calcBoll, calcMA } from './backtest-indicators';

const TIME_RANGES = [
  { label: '近1月', days: 20 },
  { label: '近3月', days: 60 },
  { label: '近6月', days: 120 },
  { label: '近1年', days: 240 },
  { label: '近2年', days: 480 },
  { label: '全部', days: 0 },
];

interface StockInfo {
  code: string;
  name: string;
  klineData: KLineData[];
}

interface BacktestResultItem {
  stockCode: string;
  stockName: string;
  result: BacktestResult;
  reasoning?: ReasoningResult[];
}

export function IndependentBacktest() {
  // 股票列表
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [searching, setSearching] = useState(false);

  // 策略选择
  const [selectedStrategies, setSelectedStrategies] = useState<StrategyType[]>([]);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);

  // 回测参数
  const [timeRange, setTimeRange] = useState(120);
  const [initialCapital, setInitialCapital] = useState(100000);
  const [commission] = useState(0.0003);
  const [slippage] = useState(0.002);

  // 状态
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BacktestResultItem[]>([]);
  const [reasoningProgress, setReasoningProgress] = useState({ current: 0, total: 0, generating: false });

  // 查看依据
  const [selectedTrade, setSelectedTrade] = useState<{ item: BacktestResultItem; tradeIdx: number } | null>(null);

  const strategies = getAllStrategies();

  // 搜索添加股票
  const handleAddStock = useCallback(async () => {
    const code = searchCode.trim();
    if (!code) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/stock?action=search&keyword=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (json.success && json.data?.length > 0) {
        const stock = json.data[0];
        const stockCode = stock.code || code;
        const stockName = stock.name || code;

        if (stocks.find(s => s.code === stockCode)) {
          setSearching(false);
          return;
        }

        // 获取K线数据
        const limit = timeRange || 240;
        const klineRes = await fetch(`/api/stock?action=kline&code=${stockCode}&period=daily&limit=${limit}`);
        const klineJson = await klineRes.json();

        if (klineJson.success && klineJson.data?.length > 0) {
          setStocks(prev => [...prev, {
            code: stockCode,
            name: stockName,
            klineData: klineJson.data,
          }]);
          setSearchCode('');
        }
      }
    } catch {
      // ignore
    }
    setSearching(false);
  }, [searchCode, stocks, timeRange]);

  // 移除股票
  const removeStock = (code: string) => {
    setStocks(prev => prev.filter(s => s.code !== code));
  };

  // 切换策略
  const toggleStrategy = (key: StrategyType) => {
    setSelectedStrategies(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  // 执行回测
  const handleRun = useCallback(async () => {
    if (stocks.length === 0 || selectedStrategies.length === 0) return;
    setRunning(true);
    setResults([]);
    setProgress({ current: 0, total: stocks.length });

    const allResults: BacktestResultItem[] = [];

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      setProgress({ current: i + 1, total: stocks.length });

      let klineData = stock.klineData;
      if (timeRange > 0 && klineData.length > timeRange) {
        klineData = klineData.slice(-timeRange);
      }

      const config: BacktestConfig = {
        strategies: selectedStrategies,
        initialCapital,
        commission,
        slippage,
        positionSize: 0.25,
      };

      const result = runBacktest(klineData, config);
      allResults.push({
        stockCode: stock.code,
        stockName: stock.name,
        result,
      });
    }

    setResults(allResults);
    setRunning(false);

    // 异步生成AI依据
    const allTradeRequests: { item: BacktestResultItem; tradeIdx: number; stock: StockInfo }[] = [];
    for (const item of allResults) {
      const stock = stocks.find(s => s.code === item.stockCode);
      if (!stock) continue;
      for (let ti = 0; ti < item.result.trades.length; ti++) {
        allTradeRequests.push({ item, tradeIdx: ti, stock });
      }
    }

    if (allTradeRequests.length > 0) {
      setReasoningProgress({ current: 0, total: allTradeRequests.length, generating: true });

      // 分批生成（每批5个，避免API限流）
      const batchSize = 5;
      const allReasoning: Map<string, ReasoningResult[]> = new Map();

      for (let b = 0; b < allTradeRequests.length; b += batchSize) {
        const batch = allTradeRequests.slice(b, b + batchSize);
        const batchPromises = batch.map(async ({ item, tradeIdx, stock }) => {
          const trade = item.result.trades[tradeIdx];
          const tradeDateIdx = stock.klineData.findIndex(k => k.date === trade.date);
          const startIdx = Math.max(0, tradeDateIdx - 9);
          const klineSlice: KLineSnapshot[] = stock.klineData.slice(startIdx, tradeDateIdx + 1).map(k => ({
            date: k.date, open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume,
          }));

          // 计算技术指标快照
          const closes = stock.klineData.slice(0, tradeDateIdx + 1).map(k => k.close);
          const highs = stock.klineData.slice(0, tradeDateIdx + 1).map(k => k.high);
          const lows = stock.klineData.slice(0, tradeDateIdx + 1).map(k => k.low);

          const indicators: IndicatorSnapshot = {};
          const macdData = calcMACD(closes);
          if (tradeDateIdx >= 0 && macdData.dif[tradeDateIdx] !== undefined) {
            indicators.macd = { dif: macdData.dif[tradeDateIdx], dea: macdData.dea[tradeDateIdx], histogram: macdData.macd[tradeDateIdx] };
          }
          const kdjData = calcKDJ(highs, lows, closes);
          if (tradeDateIdx >= 0 && kdjData.k[tradeDateIdx] !== undefined) {
            indicators.kdj = { k: kdjData.k[tradeDateIdx], d: kdjData.d[tradeDateIdx], j: kdjData.j[tradeDateIdx] };
          }
          const rsiData = calcRSI(closes);
          if (tradeDateIdx >= 0 && rsiData[tradeDateIdx] !== undefined) {
            indicators.rsi = rsiData[tradeDateIdx];
          }
          const bollData = calcBoll(closes);
          if (tradeDateIdx >= 0 && bollData.upper[tradeDateIdx] !== undefined) {
            indicators.boll = { upper: bollData.upper[tradeDateIdx], middle: bollData.middle[tradeDateIdx], lower: bollData.lower[tradeDateIdx] };
          }
          const ma5 = calcMA(closes, 5);
          const ma20 = calcMA(closes, 20);
          const ma60 = calcMA(closes, 60);
          indicators.ma = {};
          if (tradeDateIdx >= 0) {
            indicators.ma[5] = ma5[tradeDateIdx];
            indicators.ma[20] = ma20[tradeDateIdx];
            if (ma60[tradeDateIdx]) indicators.ma[60] = ma60[tradeDateIdx];
          }

          const { generateTradeReasoning } = await import('@/lib/backtest-reasoning');
          const reasoning = await generateTradeReasoning({
            strategy: trade.strategy,
            direction: trade.type,
            tradeDate: trade.date,
            tradePrice: trade.price,
            stockCode: item.stockCode,
            stockName: item.stockName,
            klineData: klineSlice,
            indicators,
          });

          return {
            strategy: trade.strategy,
            direction: trade.type as 'buy' | 'sell',
            tradeDate: trade.date,
            reasoning,
            generatedAt: new Date().toISOString(),
          } as ReasoningResult;
        });

        const batchResults = await Promise.all(batchPromises);

        // 分配结果到对应item
        for (let bi = 0; bi < batch.length; bi++) {
          const { item, tradeIdx } = batch[bi];
          const key = item.stockCode;
          if (!allReasoning.has(key)) allReasoning.set(key, []);
          const arr = allReasoning.get(key)!;
          arr[tradeIdx] = batchResults[bi];
        }

        setReasoningProgress({
          current: Math.min(b + batchSize, allTradeRequests.length),
          total: allTradeRequests.length,
          generating: true,
        });
      }

      // 更新results with reasoning
      setResults(prev => prev.map(item => ({
        ...item,
        reasoning: allReasoning.get(item.stockCode) || [],
      })));

      setReasoningProgress({ current: allTradeRequests.length, total: allTradeRequests.length, generating: false });
    }
  }, [stocks, selectedStrategies, timeRange, initialCapital, commission, slippage]);

  // 导出CSV
  const exportCSV = (item: BacktestResultItem) => {
    const headers = ['日期', '方向', '策略', '价格', '数量', '金额', '手续费'];
    const rows = item.result.trades.map(t => [
      t.date,
      t.type === 'buy' ? '买入' : '卖出',
      t.strategy,
      t.price.toFixed(2),
      t.shares.toString(),
      t.amount.toFixed(2),
      t.commission.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest_${item.stockCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 保存结果
  const saveResult = (item: BacktestResultItem) => {
    const saved = JSON.parse(localStorage.getItem('backtest_results') || '[]');
    saved.push({
      stockCode: item.stockCode,
      stockName: item.stockName,
      result: item.result,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem('backtest_results', JSON.stringify(saved));
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 标题栏 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <BarChart3 size={14} className="text-accent-blue" />
          历史回测
        </h3>
        {results.length > 0 && (
          <span className="text-xs text-text-secondary">
            共{results.length}只股票 · {results.reduce((s, r) => s + r.result.trades.length, 0)}笔交易
          </span>
        )}
      </div>

      {/* 股票输入区 */}
      <div className="flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={searchCode}
              onChange={e => setSearchCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddStock()}
              placeholder="输入股票代码/名称"
              className="w-full bg-surface-input border border-border-subtle rounded px-2 py-1.5 pl-7 text-xs text-text-primary placeholder:text-text-secondary focus:border-accent-blue focus:outline-none"
            />
          </div>
          <button
            onClick={handleAddStock}
            disabled={searching}
            className="px-2.5 py-1.5 bg-accent-blue/20 text-accent-blue rounded text-xs hover:bg-accent-blue/30 disabled:opacity-50"
          >
            {searching ? <Loader2 size={12} className="animate-spin" /> : '添加'}
          </button>
        </div>

        {/* 已添加股票 */}
        {stocks.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {stocks.map(s => (
              <span key={s.code} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-raised border border-border-subtle rounded text-xs text-text-primary">
                {s.name}
                <button onClick={() => removeStock(s.code)} className="text-text-secondary hover:text-red-400">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 策略选择 */}
      <div className="flex-shrink-0">
        <button
          onClick={() => setShowStrategyPicker(!showStrategyPicker)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-raised border border-border-subtle rounded text-xs text-text-primary hover:border-accent-blue w-full justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Settings size={12} className="text-accent-blue" />
            {selectedStrategies.length > 0
              ? `已选${selectedStrategies.length}个策略`
              : '选择回测策略'}
          </span>
          <span className="text-text-secondary">{selectedStrategies.length > 0 ? '点击修改' : '点击选择'}</span>
        </button>

        {showStrategyPicker && (
          <div className="mt-1.5 p-2 bg-surface-raised border border-border-strong rounded max-h-48 overflow-y-auto custom-scrollbar">
            {(['MACD', 'KDJ', 'RSI', 'BOLL', 'MA', '分析引擎'] as const).map(group => {
              const groupStrategies = strategies.filter(s => {
                if (group === 'MACD') return s.builtinKey?.startsWith('macd_');
                if (group === 'KDJ') return s.builtinKey?.startsWith('kdj_');
                if (group === 'RSI') return s.builtinKey?.startsWith('rsi_');
                if (group === 'BOLL') return s.builtinKey?.startsWith('boll_');
                if (group === 'MA') return s.builtinKey?.startsWith('ma_');
                return s.builtinKey?.startsWith('chanlun_') || s.builtinKey?.startsWith('wave_') || s.builtinKey?.startsWith('tech_');
              });
              if (groupStrategies.length === 0) return null;
              return (
                <div key={group} className="mb-1.5">
                  <div className="text-[10px] text-text-secondary mb-0.5 font-medium">{group}</div>
                  <div className="flex flex-wrap gap-1">
                    {groupStrategies.map(s => (
                      <button
                        key={s.id}
                        onClick={() => s.builtinKey && toggleStrategy(s.builtinKey)}
                        className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                          s.builtinKey && selectedStrategies.includes(s.builtinKey)
                            ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                            : 'bg-transparent border-border-subtle text-text-secondary hover:border-accent-blue/50 hover:text-text-primary'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 参数设置 */}
      <div className="flex-shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-secondary">周期</span>
          <div className="flex gap-0.5">
            {TIME_RANGES.map(t => (
              <button
                key={t.days}
                onClick={() => setTimeRange(t.days)}
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  timeRange === t.days
                    ? 'bg-accent-blue text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-secondary">初始资金</span>
          <input
            type="number"
            value={initialCapital}
            onChange={e => setInitialCapital(Number(e.target.value))}
            className="w-20 bg-surface-input border border-border-subtle rounded px-1.5 py-0.5 text-[10px] text-text-primary focus:border-accent-blue focus:outline-none"
          />
        </div>
      </div>

      {/* 执行按钮 */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          onClick={handleRun}
          disabled={running || stocks.length === 0 || selectedStrategies.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white rounded text-xs font-medium hover:bg-accent-blue/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {running ? `回测中 ${progress.current}/${progress.total}` : '开始回测'}
        </button>
        {running && (
          <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue transition-all"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        )}
        {reasoningProgress.generating && (
          <span className="text-[10px] text-accent-blue flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            AI依据 {reasoningProgress.current}/{reasoningProgress.total}
          </span>
        )}
      </div>

      {/* 结果展示 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
        {results.map((item, idx) => (
          <div key={idx} className="bg-surface-raised border border-border-subtle rounded p-3">
            {/* 股票标题 */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-primary">
                {item.stockName} ({item.stockCode})
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => saveResult(item)}
                  className="p-1 text-text-secondary hover:text-accent-blue"
                  title="保存结果"
                >
                  <Save size={12} />
                </button>
                <button
                  onClick={() => exportCSV(item)}
                  className="p-1 text-text-secondary hover:text-accent-blue"
                  title="导出CSV"
                >
                  <Download size={12} />
                </button>
              </div>
            </div>

            {/* 指标卡片 */}
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              <MetricCard
                label="总收益率"
                value={`${(item.result.metrics.totalReturn * 100).toFixed(2)}%`}
                color={item.result.metrics.totalReturn >= 0 ? 'up' : 'down'}
              />
              <MetricCard
                label="年化收益"
                value={`${(item.result.metrics.annualizedReturn * 100).toFixed(2)}%`}
                color={item.result.metrics.annualizedReturn >= 0 ? 'up' : 'down'}
              />
              <MetricCard
                label="最大回撤"
                value={`${(item.result.metrics.maxDrawdown * 100).toFixed(2)}%`}
                color="down"
              />
              <MetricCard
                label="夏普比率"
                value={item.result.metrics.sharpeRatio.toFixed(2)}
                color={item.result.metrics.sharpeRatio >= 1 ? 'up' : item.result.metrics.sharpeRatio >= 0 ? 'neutral' : 'down'}
              />
              <MetricCard
                label="胜率"
                value={`${(item.result.metrics.winRate * 100).toFixed(1)}%`}
                color={item.result.metrics.winRate >= 0.5 ? 'up' : 'down'}
              />
              <MetricCard
                label="盈亏比"
                value={item.result.metrics.profitLossRatio.toFixed(2)}
                color={item.result.metrics.profitLossRatio >= 1.5 ? 'up' : 'down'}
              />
              <MetricCard
                label="交易次数"
                value={item.result.metrics.totalTrades.toString()}
                color="neutral"
              />
              <MetricCard
                label="盈利/亏损"
                value={`${item.result.metrics.winningTrades}/${item.result.metrics.losingTrades}`}
                color="neutral"
              />
            </div>

            {/* K线图 + 买卖点标注 */}
            <BacktestChart
              klineData={stocks.find(s => s.code === item.stockCode)?.klineData || []}
              trades={item.result.trades}
              onTradeClick={(tradeIdx: number) => setSelectedTrade({ item, tradeIdx })}
            />

            {/* 交易记录 */}
            {item.result.trades.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-text-secondary mb-1 font-medium">交易记录</div>
                <div className="max-h-32 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-surface-raised">
                      <tr className="text-text-secondary border-b border-border-subtle">
                        <th className="text-left py-0.5 px-1">日期</th>
                        <th className="text-left py-0.5 px-1">方向</th>
                        <th className="text-right py-0.5 px-1">价格</th>
                        <th className="text-right py-0.5 px-1">数量</th>
                        <th className="text-left py-0.5 px-1">策略</th>
                        <th className="text-center py-0.5 px-1">依据</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.result.trades.map((t, ti) => (
                        <tr key={ti} className="border-b border-border-subtle/50 hover:bg-surface-hover">
                          <td className="py-0.5 px-1 text-text-primary">{t.date}</td>
                          <td className={`py-0.5 px-1 font-medium ${t.type === 'buy' ? 'text-up' : 'text-down'}`}>
                            {t.type === 'buy' ? '买入' : '卖出'}
                          </td>
                          <td className="py-0.5 px-1 text-right text-text-primary font-mono-num">{t.price.toFixed(2)}</td>
                          <td className="py-0.5 px-1 text-right text-text-primary font-mono-num">{t.shares}</td>
                          <td className="py-0.5 px-1 text-text-secondary">{t.strategy}</td>
                          <td className="py-0.5 px-1 text-center">
                            {item.reasoning?.[ti] ? (
                              <button
                                onClick={() => setSelectedTrade({ item, tradeIdx: ti })}
                                className="text-accent-blue hover:underline"
                              >
                                查看
                              </button>
                            ) : (
                              <span className="text-text-secondary">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}

        {results.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center h-32 text-text-secondary">
            <BarChart3 size={24} className="mb-2 opacity-30" />
            <p className="text-xs">添加股票、选择策略后开始回测</p>
          </div>
        )}
      </div>

      {/* 交易依据弹窗 */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedTrade(null)}>
          <div className="bg-surface-panel border border-border-strong rounded-lg p-4 max-w-md w-full mx-4 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-text-primary">交易依据分析</h4>
              <button onClick={() => setSelectedTrade(null)} className="text-text-secondary hover:text-text-primary">
                <X size={14} />
              </button>
            </div>
            {(() => {
              const trade = selectedTrade.item.result.trades[selectedTrade.tradeIdx];
              const reasoning = selectedTrade.item.reasoning?.[selectedTrade.tradeIdx];
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${trade.type === 'buy' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'}`}>
                      {trade.type === 'buy' ? '买入' : '卖出'}
                    </span>
                    <span className="text-xs text-text-primary">{trade.date}</span>
                    <span className="text-xs text-text-primary font-mono-num">{trade.price.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-text-secondary mb-2">
                    策略：{trade.strategy} · 数量：{trade.shares}股 · 金额：{trade.amount.toFixed(2)}
                  </div>
                  <div className="bg-surface-input border border-border-subtle rounded p-3">
                    {reasoning ? (
                      <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{reasoning.reasoning}</p>
                    ) : (
                      <p className="text-xs text-text-secondary">AI依据尚未生成，请稍后查看</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// 指标卡片
function MetricCard({ label, value, color }: { label: string; value: string; color: 'up' | 'down' | 'neutral' }) {
  const colorClass = color === 'up' ? 'text-up' : color === 'down' ? 'text-down' : 'text-text-primary';
  return (
    <div className="bg-surface-input border border-border-subtle rounded px-2 py-1.5">
      <div className="text-[9px] text-text-secondary mb-0.5">{label}</div>
      <div className={`text-xs font-bold font-mono-num ${colorClass}`}>{value}</div>
    </div>
  );
}
