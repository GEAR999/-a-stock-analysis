import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Settings, Play, Pause, Trash2, Brain, Sparkles, Activity } from 'lucide-react';
import type { Account, QuantStrategy, StrategySource } from './types';
import { saveAccount, deleteAccount, executeBuy, executeSell, canBuyStock } from './storage';
import { formatMoney } from './utils';
import { isTradingTime } from '@/lib/trading-time';
import { resolveStrategyTypes, getSignalLabel } from './strategy-bridge';
import { analyzeChanlun, analyzeWaves, getAllIndicators } from '@/lib/analysis';
import { fetchKLineData } from '@/lib/data-source';
import type { KLineData } from '@/lib/types';

interface QuantAutoTradePanelProps {
  account: Account;
  stockCode: string;
  stockName: string;
  onUpdate: (updated: Account | null) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

// 自动交易轮询间隔（毫秒）
const AUTO_TRADE_INTERVAL = 30_000;

// 信号检测结果
interface SignalResult {
  type: 'buy' | 'sell';
  signal: string;
  price: number;
  stockCode: string;
  stockName: string;
}

/**
 * 根据策略理论检测买卖信号
 */
function detectSignals(kline: KLineData[], theories: StrategySource[]): SignalResult[] {
  if (kline.length < 30) return [];
  const signals: SignalResult[] = [];
  const lastIdx = kline.length - 1;
  const prevIdx = lastIdx - 1;

  for (const theory of theories) {
    if (theory === 'chanlun' || theory === 'composite') {
      const result = analyzeChanlun(kline);
      // 检查最近的买信号（最后5根K线内）
      for (const sig of result.buySignals) {
        if (sig.index >= lastIdx - 4) {
          signals.push({
            type: 'buy',
            signal: `缠论${sig.type}买`,
            price: sig.price,
            stockCode: '',
            stockName: '',
          });
        }
      }
      for (const sig of result.sellSignals) {
        if (sig.index >= lastIdx - 4) {
          signals.push({
            type: 'sell',
            signal: `缠论${sig.type}卖`,
            price: sig.price,
            stockCode: '',
            stockName: '',
          });
        }
      }
    }

    if (theory === 'wave' || theory === 'composite') {
      const result = analyzeWaves(kline);
      if (result.waves.length > 0) {
        const lastWave = result.waves[result.waves.length - 1];
        // 推动浪起点(第1浪) = 买入信号
        if (lastWave.type === 'impulse' && lastWave.label.includes('1') && lastWave.end >= lastIdx - 2) {
          signals.push({
            type: 'buy',
            signal: '波浪起点买入(第1浪)',
            price: kline[lastWave.end].low,
            stockCode: '',
            stockName: '',
          });
        }
        // 推动浪终点(第5浪) = 卖出信号
        if (lastWave.type === 'impulse' && lastWave.label.includes('5') && lastWave.end >= lastIdx - 2) {
          signals.push({
            type: 'sell',
            signal: '波浪终点卖出(第5浪)',
            price: kline[lastWave.end].high,
            stockCode: '',
            stockName: '',
          });
        }
      }
    }

    if (theory === 'technical' || theory === 'composite') {
      const indicators = getAllIndicators(kline);
      const { macd, kdj, rsi, boll, ma } = indicators;

      if (macd.length >= 2) {
        const cur = macd[lastIdx];
        const prev = macd[prevIdx];
        // MACD金叉
        if (cur.dif > cur.dea && prev.dif <= prev.dea) {
          signals.push({ type: 'buy', signal: 'MACD金叉', price: kline[lastIdx].close, stockCode: '', stockName: '' });
        }
        // MACD死叉
        if (cur.dif < cur.dea && prev.dif >= prev.dea) {
          signals.push({ type: 'sell', signal: 'MACD死叉', price: kline[lastIdx].close, stockCode: '', stockName: '' });
        }
      }

      if (kdj.length >= 2) {
        const cur = kdj[lastIdx];
        const prev = kdj[prevIdx];
        // KDJ超卖金叉
        if (prev.k < 20 && cur.k > cur.d && prev.k <= prev.d) {
          signals.push({ type: 'buy', signal: 'KDJ超卖金叉', price: kline[lastIdx].close, stockCode: '', stockName: '' });
        }
        // KDJ超买死叉
        if (prev.k > 80 && cur.k < cur.d && prev.k >= prev.d) {
          signals.push({ type: 'sell', signal: 'KDJ超买死叉', price: kline[lastIdx].close, stockCode: '', stockName: '' });
        }
      }

      if (rsi.length >= 1) {
        const curRsi = rsi[lastIdx].rsi;
        // RSI超卖
        if (curRsi < 30) {
          signals.push({ type: 'buy', signal: `RSI超卖(${curRsi.toFixed(1)})`, price: kline[lastIdx].close, stockCode: '', stockName: '' });
        }
        // RSI超买
        if (curRsi > 70) {
          signals.push({ type: 'sell', signal: `RSI超买(${curRsi.toFixed(1)})`, price: kline[lastIdx].close, stockCode: '', stockName: '' });
        }
      }

      if (boll.length >= 1 && ma[5] && ma[5].length > 0) {
        const curBoll = boll[lastIdx];
        const curClose = kline[lastIdx].close;
        // 布林下轨支撑
        if (curClose <= curBoll.lower) {
          signals.push({ type: 'buy', signal: '触及布林下轨', price: curClose, stockCode: '', stockName: '' });
        }
        // 布林上轨压力
        if (curClose >= curBoll.upper) {
          signals.push({ type: 'sell', signal: '触及布林上轨', price: curClose, stockCode: '', stockName: '' });
        }
      }

      // 均线金叉/死叉 (MA5/MA20)
      if (ma[5] && ma[20] && ma[5].length > 1 && ma[20].length > 1) {
        const curMa5 = ma[5][lastIdx];
        const curMa20 = ma[20][lastIdx];
        const prevMa5 = ma[5][prevIdx];
        const prevMa20 = ma[20][prevIdx];
        if (curMa5 > curMa20 && prevMa5 <= prevMa20) {
          signals.push({ type: 'buy', signal: 'MA5/20金叉', price: kline[lastIdx].close, stockCode: '', stockName: '' });
        }
        if (curMa5 < curMa20 && prevMa5 >= prevMa20) {
          signals.push({ type: 'sell', signal: 'MA5/20死叉', price: kline[lastIdx].close, stockCode: '', stockName: '' });
        }
      }
    }
  }

  return signals;
}

export function QuantAutoTradePanel({ account, stockCode, stockName, onUpdate, onToast }: QuantAutoTradePanelProps) {
  const [showStrategyConfig, setShowStrategyConfig] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const [signalLog, setSignalLog] = useState<string[]>([]);
  const accountRef = useRef(account);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 保持 accountRef 最新
  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  const strategy = account.strategy;

  // 添加日志
  const addLog = useCallback((msg: string) => {
    setSignalLog(prev => {
      const next = [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev];
      return next.slice(0, 50); // 保留最近50条
    });
  }, []);

  // 执行一轮信号检测
  const runSignalCheck = useCallback(async () => {
    const acc = accountRef.current;
    const strat = acc.strategy;
    if (!strat) return;

    const theories = strat.theories.filter(t => t !== 'manual') as StrategySource[];
    if (theories.length === 0) return;

    let updatedAccount = { ...acc };
    let tradeCount = 0;

    // === 1. 止损止盈检查（对所有持仓） ===
    for (const pos of updatedAccount.positions) {
      if (pos.quantity <= 0) continue;
      const pnlPercent = pos.avgCost > 0 ? ((pos.currentPrice - pos.avgCost) / pos.avgCost) * 100 : 0;

      // 止损
      if (pnlPercent <= -strat.stopLossPercent) {
        const reason = `止损卖出(亏损${pnlPercent.toFixed(1)}%，阈值-${strat.stopLossPercent}%)`;
        updatedAccount = executeSell(updatedAccount, pos.stockCode, pos.currentPrice, pos.quantity, reason, true);
        addLog(`止损: ${pos.stockName} ${reason}`);
        tradeCount++;
      }
      // 止盈
      else if (pnlPercent >= strat.takeProfitPercent) {
        const reason = `止盈卖出(盈利${pnlPercent.toFixed(1)}%，阈值+${strat.takeProfitPercent}%)`;
        updatedAccount = executeSell(updatedAccount, pos.stockCode, pos.currentPrice, pos.quantity, reason, true);
        addLog(`止盈: ${pos.stockName} ${reason}`);
        tradeCount++;
      }
    }

    // === 2. 跟踪列表信号检测 ===
    for (const code of acc.trackingList) {
      try {
        const result = await fetchKLineData(code, 'daily', { limit: 120 });
        if (!result.success || !result.data || result.data.length < 30) continue;

        const kline = result.data;
        const currentPrice = kline[kline.length - 1].close;

        // 检测信号
        const signals = detectSignals(kline, theories);

        // 处理卖出信号（对已持仓股票）
        for (const sig of signals.filter(s => s.type === 'sell')) {
          const pos = updatedAccount.positions.find(p => p.stockCode === code);
          if (pos && pos.quantity > 0) {
            const reason = `策略卖出信号: ${sig.signal}`;
            updatedAccount = executeSell(updatedAccount, code, currentPrice, pos.quantity, reason, true);
            addLog(`卖出: ${code} ${reason} @ ${currentPrice.toFixed(2)}`);
            tradeCount++;
            break; // 一只股票一次只处理一个卖出信号
          }
        }

        // 处理买入信号（对未持仓股票）
        for (const sig of signals.filter(s => s.type === 'buy')) {
          const hasPosition = updatedAccount.positions.some(p => p.stockCode === code && p.quantity > 0);
          if (hasPosition) continue;

          // 计算买入预算：可用资金 * 单股最大仓位比例
          const budget = updatedAccount.currentCapital * (strat.maxPositionPercent / 100);
          const check = canBuyStock(updatedAccount, code, budget);
          if (!check.can) {
            addLog(`跳过买入 ${code}: ${check.reason}`);
            continue;
          }

          // 获取股票名称（从K线数据或默认）
          const name = result.data.length > 0 ? code : code;
          const reason = `策略买入信号: ${sig.signal}`;
          updatedAccount = executeBuy(updatedAccount, code, name, currentPrice, budget, reason, true);
          addLog(`买入: ${code} ${reason} @ ${currentPrice.toFixed(2)}`);
          tradeCount++;
          break; // 一只股票一次只处理一个买入信号
        }
      } catch (err) {
        addLog(`检测 ${code} 失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    }

    // 保存更新
    if (tradeCount > 0) {
      saveAccount(updatedAccount);
      onUpdate(updatedAccount);
      addLog(`本轮完成 ${tradeCount} 笔交易`);
    }

    setLastCheckTime(new Date().toLocaleTimeString());
  }, [addLog, onUpdate]);

  // 启停定时器
  useEffect(() => {
    if (isRunning && strategy) {
      // 立即执行一次
      runSignalCheck();
      // 定时轮询
      timerRef.current = setInterval(runSignalCheck, AUTO_TRADE_INTERVAL);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRunning, strategy, runSignalCheck]);

  if (!strategy) {
    return (
      <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Bot className="w-4 h-4" />
          <span className="text-sm">此账户未配置量化策略</span>
        </div>
      </div>
    );
  }

  const runMode = account.runMode || 'realtime';
  const tradingActive = isTradingTime(runMode);

  const handleToggleAutoTrade = () => {
    if (!tradingActive && !isRunning) {
      onToast('warning', runMode === 'backtest' ? '回测模式不受交易时间限制' : '当前非交易时段，自动交易已暂停');
      // 回测模式允许启动
      if (runMode !== 'backtest') return;
    }
    const next = !isRunning;
    setIsRunning(next);
    if (next) {
      setSignalLog([]);
      addLog('自动交易已启动');
    } else {
      addLog('自动交易已暂停');
    }
    onToast('info', next ? '自动交易已启动' : '自动交易已暂停');
  };

  const handleDeleteAccount = () => {
    if (confirm(`确定要删除账户 "${account.name}" 吗？此操作不可恢复。`)) {
      deleteAccount(account.id);
      onUpdate(null);
      onToast('success', `账户 ${account.name} 已删除`);
    }
  };

  const handleUpdateStrategy = (updates: Partial<QuantStrategy>) => {
    const updatedAccount: Account = {
      ...account,
      strategy: { 
        name: account.strategy?.name || '默认策略',
        theories: account.strategy?.theories || ['technical'] as StrategySource[],
        stopLossPercent: account.strategy?.stopLossPercent || 5,
        takeProfitPercent: account.strategy?.takeProfitPercent || 10,
        maxPositionPercent: account.strategy?.maxPositionPercent || 20,
        autoTrade: account.strategy?.autoTrade || false,
        aiEnabled: account.strategy?.aiEnabled || false,
        aiType: account.strategy?.aiType || 'rule-based',
        aiWeight: account.strategy?.aiWeight ?? 20,
        ...updates 
      },
    };
    saveAccount(updatedAccount);
    onUpdate(updatedAccount);
  };

  // 解析当前策略对应的信号类型（用于展示）
  const resolvedSignals = resolveStrategyTypes(strategy.theories);

  return (
    <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-[var(--text-primary)]">量化自动交易</span>
          {isRunning && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-green-500/20 text-[var(--accent-green)] border border-green-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              运行中
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowStrategyConfig(!showStrategyConfig)}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="策略配置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggleAutoTrade}
            className={`p-1.5 transition-colors ${isRunning ? 'text-[var(--accent-yellow)] hover:text-yellow-300' : 'text-[var(--accent-green)] hover:text-green-300'}`}
            title={isRunning ? '暂停' : '启动'}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDeleteAccount}
            className="p-1.5 text-[var(--accent-red)] hover:text-red-300 transition-colors"
            title="删除账户"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 策略概览 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">策略名称</span>
          <span className="text-[var(--text-primary)]">{strategy.name}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">运行模式</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
            account.runMode === 'backtest' ? 'bg-blue-500/20 text-[var(--accent-blue)]' : 'bg-red-500/20 text-[var(--accent-red)]'
          }`}>
            {account.runMode === 'backtest' ? '📊 历史回测' : '🔴 实时验证'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">跟踪股票</span>
          <span className="text-[var(--text-primary)]">{account.trackingList.length}只</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">单股最大仓位</span>
          <span className="text-[var(--text-primary)]">{strategy.maxPositionPercent}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">止损 / 止盈</span>
          <span className="text-[var(--text-primary)]">-{strategy.stopLossPercent}% / +{strategy.takeProfitPercent}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">交易时段</span>
          <span className={isTradingTime(runMode) ? 'text-[var(--accent-green)]' : 'text-[var(--text-secondary)]'}>
            {isTradingTime(runMode) ? '交易中' : '已休市'}
          </span>
        </div>
        {/* 策略信号摘要 */}
        <div className="pt-1">
          <span className="text-[10px] text-[var(--text-secondary)]">信号类型 ({resolvedSignals.length}个)</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {resolvedSignals.slice(0, 8).map(sig => (
              <span key={sig} className="px-1 py-0.5 text-[9px] rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {getSignalLabel(sig)}
              </span>
            ))}
            {resolvedSignals.length > 8 && (
              <span className="px-1 py-0.5 text-[9px] text-[var(--text-muted)]">+{resolvedSignals.length - 8}</span>
            )}
          </div>
        </div>
      </div>

      {/* 运行日志 */}
      {isRunning && (
        <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] text-[var(--text-secondary)]">
              运行日志
              {lastCheckTime ? (
                <span className="text-[var(--text-muted)]"> | 上次检测: {lastCheckTime}</span>
              ) : null}
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {signalLog.length === 0 ? (
              <div className="text-[10px] text-[var(--text-muted)]">正在初始化...</div>
            ) : (
              signalLog.map((log, i) => (
                <div key={i} className={`text-[10px] font-mono ${
                  log.includes('买入') ? 'text-[var(--accent-red)]' :
                  log.includes('卖出') || log.includes('止损') || log.includes('止盈') ? 'text-[var(--accent-green)]' :
                  log.includes('失败') || log.includes('跳过') ? 'text-[var(--accent-yellow)]' :
                  'text-[var(--text-muted)]'
                }`}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 策略配置面板 */}
      {showStrategyConfig && (
        <div className="mt-3 pt-3 border-t border-[var(--border-default)] space-y-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)]">策略名称</label>
            <input
              type="text"
              value={strategy.name}
              onChange={(e) => handleUpdateStrategy({ name: e.target.value })}
              className="w-full mt-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">单股最大仓位 (%)</label>
            <input
              type="number"
              value={strategy.maxPositionPercent}
              onChange={(e) => handleUpdateStrategy({ maxPositionPercent: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">止损比例 (%)</label>
            <input
              type="number"
              value={strategy.stopLossPercent}
              onChange={(e) => handleUpdateStrategy({ stopLossPercent: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">止盈比例 (%)</label>
            <input
              type="number"
              value={strategy.takeProfitPercent}
              onChange={(e) => handleUpdateStrategy({ takeProfitPercent: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
            />
          </div>

          {/* AI辅助判断配置 */}
          <div className="pt-3 border-t border-[var(--border-default)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <label className="text-xs text-[var(--text-primary)]">AI辅助判断</label>
              </div>
              <button
                onClick={() => handleUpdateStrategy({ aiEnabled: !strategy.aiEnabled })}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  strategy.aiEnabled ? 'bg-purple-500' : 'bg-[var(--bg-card)]'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  strategy.aiEnabled ? 'translate-x-4' : ''
                }`} />
              </button>
            </div>

            {strategy.aiEnabled && (
              <div className="mt-3 space-y-3 pl-5">
                {/* AI适配器选择 */}
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)]">AI适配器</label>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => handleUpdateStrategy({ aiType: 'rule-based' })}
                      className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors ${
                        strategy.aiType === 'rule-based'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      规则增强
                    </button>
                    <button
                      disabled
                      className="flex-1 px-2 py-1.5 text-[10px] rounded border border-[var(--border-default)] bg-[var(--bg-card)]/30 text-[var(--text-muted)] cursor-not-allowed relative"
                    >
                      API接口
                      <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[8px] bg-[var(--bg-card)] text-[var(--text-secondary)] rounded">
                        即将推出
                      </span>
                    </button>
                  </div>
                </div>

                {/* AI权重配置 */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-[var(--text-secondary)]">AI权重占比</label>
                    <span className="text-[10px] text-purple-400 font-mono">{strategy.aiWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={strategy.aiWeight}
                    onChange={(e) => handleUpdateStrategy({ aiWeight: Number(e.target.value) })}
                    className="w-full mt-1 h-1 bg-[var(--bg-card)] rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-0.5">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
