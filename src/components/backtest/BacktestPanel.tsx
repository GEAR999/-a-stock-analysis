"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Info, Download, Upload, Plus, Search, X, RefreshCw } from "lucide-react";
import type { Account, AccountSummary, ToastMessage, BuySignal, Trade, Position, SingleStrategyStats, FailureStats, FailureReason, StrategySource, AccountType, StrategyWeight } from "./types";
import { StrategySelector } from "./StrategySelector";
import {
  getAllAccountSummaries, loadAccount, createAccount, deleteAccount,
  getActiveAccountId, setActiveAccountId, saveAccount,
  calculateMetrics, getTotalAssets, generateEquityCurve,
  canBuyStock, executeBuy, executeSell, cleanGarbageData, resetAccount,
  generateDemoAccount, generateId, calculateStrategyStats, calculateFailureStats,
  calculateBenchmarkComparison, calculateConsecutiveLosses,
  calculateMaxDrawdownPeriod, calculateMaxDailyLoss, calculateSlippageStats,
} from "./storage";
import { useAppState } from "@/hooks/useAppState";
import EquityCurveChart from "./EquityCurveChart";
import { HistoryBacktestPanel } from "./HistoryBacktestPanel";
import { TradingStatusIndicator } from "./TradingStatusIndicator";

// ===== 失败原因标签配置 =====
const FAILURE_REASON_CONFIG: Record<FailureReason, { label: string; color: string; bg: string }> = {
  theory_fail: { label: "理论失效", color: "text-red-400", bg: "bg-red-500/15 border-red-500/30" },
  market_crash: { label: "市场异常", color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/30" },
  chase_high: { label: "追涨杀跌", color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
  overweight: { label: "仓位过重", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  no_stop_loss: { label: "止损不及时", color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30" },
  bad_timing: { label: "择时失误", color: "text-cyan-400", bg: "bg-cyan-500/15 border-cyan-500/30" },
};

const STRATEGY_LABELS: Record<StrategySource, { label: string; color: string }> = {
  chanlun: { label: "缠论", color: "text-purple-400" },
  wave: { label: "波浪", color: "text-blue-400" },
  technical: { label: "技术", color: "text-green-400" },
  composite: { label: "综合", color: "text-amber-400" },
  manual: { label: "手动", color: "text-gray-400" },
};

// ===== Toast通知 =====
function Toast({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => onRemove(t.id), 3000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onRemove]);

  const colorMap = {
    success: "border-green-500/50 bg-green-500/10 text-green-400",
    error: "border-red-500/50 bg-red-500/10 text-red-400",
    warning: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
    info: "border-blue-500/50 bg-blue-500/10 text-blue-400",
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`px-3 py-2 rounded border text-xs ${colorMap[t.type]} cursor-pointer`} onClick={() => onRemove(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ===== 确认对话框 =====
function ConfirmDialog({ title, message, confirmText, onConfirm, onCancel }: {
  title: string; message: string; confirmText?: string; onConfirm: () => void; onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#111827] border border-gray-700 rounded p-4 w-80">
        <h3 className="text-sm font-medium text-white mb-2">{title}</h3>
        <p className="text-xs text-gray-400 mb-3">{message}</p>
        {confirmText && (
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={`请输入"${confirmText}"确认`}
            className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 mb-3 focus:outline-none focus:border-blue-500" />
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200">取消</button>
          <button onClick={onConfirm} disabled={!!confirmText && input !== confirmText}
            className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 disabled:opacity-40">确认</button>
        </div>
      </div>
    </div>
  );
}

// ===== 新建账户对话框 =====
function CreateAccountDialog({ onCreate, onCancel }: { onCreate: (n: string, c: number, t: AccountType) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [capital, setCapital] = useState("1000000");
  const [accountType, setAccountType] = useState<AccountType>("manual");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#111827] border border-gray-700 rounded p-4 w-80">
        <h3 className="text-sm font-medium text-white mb-3">新建账户</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">账户名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如: 短线账户"
              className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">初始资金</label>
            <input type="number" value={capital} onChange={(e) => setCapital(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">账户类型</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAccountType("manual")}
                className={`flex-1 px-3 py-2 text-xs rounded border transition-colors ${
                  accountType === "manual"
                    ? "bg-blue-500/20 border-blue-500 text-blue-400"
                    : "bg-[#0a0e17] border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div className="font-medium">手动交易</div>
                <div className="text-[10px] opacity-70 mt-0.5">手动买卖操作</div>
              </button>
              <button
                onClick={() => setAccountType("quant")}
                className={`flex-1 px-3 py-2 text-xs rounded border transition-colors ${
                  accountType === "quant"
                    ? "bg-purple-500/20 border-purple-500 text-purple-400"
                    : "bg-[#0a0e17] border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div className="font-medium">量化回测</div>
                <div className="text-[10px] opacity-70 mt-0.5">策略自动执行</div>
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200">取消</button>
          <button onClick={() => name.trim() && onCreate(name.trim(), Number(capital) || 1000000, accountType)} disabled={!name.trim()}
            className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 disabled:opacity-40">创建</button>
        </div>
      </div>
    </div>
  );
}

// ===== 额度设置对话框 =====
function StockLimitDialog({ stockCode, stockName, currentLimit, onSave, onCancel }: {
  stockCode: string; stockName: string; currentLimit?: number; onSave: (c: string, l: number) => void; onCancel: () => void;
}) {
  const [limit, setLimit] = useState(currentLimit?.toString() || "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#111827] border border-gray-700 rounded p-4 w-80">
        <h3 className="text-sm font-medium text-white mb-1">设置买入额度</h3>
        <p className="text-[10px] text-gray-500 mb-3">{stockName} ({stockCode})</p>
        <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="不填则不限制"
          className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200">取消</button>
          <button onClick={() => onSave(stockCode, Number(limit) || 0)} className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30">保存</button>
        </div>
      </div>
    </div>
  );
}

// ===== 手动交易对话框（增强版） =====
function TradeDialog({ stockCode, stockName, currentPrice, direction, availableCapital, onExecute, onCancel }: {
  stockCode: string; stockName: string; currentPrice: number; direction: "buy" | "sell"; availableCapital: number;
  onExecute: (p: number, q: number) => void; onCancel: () => void;
}) {
  const [price, setPrice] = useState(currentPrice > 0 ? currentPrice.toString() : "");
  const [quantity, setQuantity] = useState("100");
  
  // 计算指定仓位比例的股数（整手）
  const calculateShares = (ratio: number) => {
    const p = Number(price);
    if (!p || p <= 0) return 0;
    const capital = availableCapital * ratio;
    return Math.floor(capital / p / 100) * 100;
  };
  
  const positionRatios = [
    { label: "全仓", ratio: 1.0, percent: "100%" },
    { label: "半仓", ratio: 0.5, percent: "50%" },
    { label: "1/3仓", ratio: 1/3, percent: "33%" },
    { label: "1/4仓", ratio: 0.25, percent: "25%" },
  ];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#111827] border border-gray-700 rounded-lg p-4 w-80 max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-medium text-white mb-1">{direction === "buy" ? "买入" : "卖出"} {stockName}</h3>
        <p className="text-[10px] text-gray-500 mb-3">{stockCode}</p>
        <div className="space-y-3">
          {/* 价格输入 */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">交易价格</label>
            <div className="flex gap-2">
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="输入价格"
                className="flex-1 px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
              {currentPrice > 0 && (
                <button onClick={() => setPrice(currentPrice.toString())}
                  className="px-2 py-1.5 text-[10px] bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 whitespace-nowrap">
                  📊 现价 {currentPrice.toFixed(2)}
                </button>
              )}
            </div>
          </div>
          
          {/* 仓位快捷选择（仅买入时显示） */}
          {direction === "buy" && (
            <div>
              <label className="text-[10px] text-gray-500 block mb-1.5">仓位快捷选择</label>
              <div className="flex gap-1.5 flex-wrap">
                {positionRatios.map(({ label, ratio, percent }) => (
                  <button key={label}
                    onClick={() => { const shares = calculateShares(ratio); if (shares > 0) setQuantity(shares.toString()); }}
                    className="px-2 py-1 text-[10px] bg-gray-700/50 text-gray-300 rounded hover:bg-gray-600/50 hover:text-white transition-colors">
                    {label} ({percent})
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* 数量输入 */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">数量 (股)</label>
            <input type="number" step="100" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              placeholder="输入股数（100的整数倍）"
              className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
          </div>
          
          {/* 预计金额 */}
          <div className="bg-[#0a0e17] rounded p-2 text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">预计金额</span>
              <span className="text-gray-200 font-mono">¥{(Number(price) * Number(quantity)).toLocaleString()}</span>
            </div>
            {direction === "buy" && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">可用资金</span>
                  <span className="text-gray-200 font-mono">¥{availableCapital.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">资金占比</span>
                  <span className={`font-mono ${Number(price) * Number(quantity) > availableCapital ? 'text-red-400' : 'text-gray-200'}`}>
                    {availableCapital > 0 ? ((Number(price) * Number(quantity) / availableCapital) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </>
            )}
            {direction === "sell" && (
              <div className="flex justify-between">
                <span className="text-gray-500">预计收入</span>
                <span className="text-green-400 font-mono">+¥{(Number(price) * Number(quantity)).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200">取消</button>
          <button onClick={() => onExecute(Number(price), Number(quantity))}
            disabled={!price || !quantity || Number(price) <= 0 || Number(quantity) <= 0}
            className={`px-3 py-1.5 text-xs rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
              direction === "buy" 
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" 
                : "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
            }`}>
            确认{direction === "buy" ? "买入" : "卖出"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 持仓展开详情 =====
function PositionDetail({ position, account, now }: { position: Position; account: Account; now: number }) {
  const holdingDays = position.buyTime ? Math.floor((now - position.buyTime) / 86400000) : (position.holdingDays || 0);

  return (
    <div className="mt-2 pt-2 border-t border-gray-800 space-y-2">
      {/* 基本信息 */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="bg-[#0a0e17] rounded p-1.5">
          <span className="text-gray-600 block">买入时间</span>
          <span className="text-gray-300">{position.buyTime ? new Date(position.buyTime).toLocaleDateString() : '--'}</span>
        </div>
        <div className="bg-[#0a0e17] rounded p-1.5">
          <span className="text-gray-600 block">持仓天数</span>
          <span className="text-gray-300 font-mono">{holdingDays}天</span>
        </div>
        <div className="bg-[#0a0e17] rounded p-1.5">
          <span className="text-gray-600 block">策略来源</span>
          <span className={position.strategy ? STRATEGY_LABELS[position.strategy].color : "text-gray-400"}>
            {position.strategy ? STRATEGY_LABELS[position.strategy].label : "未知"}
          </span>
        </div>
      </div>

      {/* 买入依据 */}
      {position.buyReason && (
        <div className="bg-[#0a0e17] rounded p-1.5">
          <span className="text-[10px] text-gray-600 block mb-0.5">买入依据</span>
          <span className="text-[10px] text-gray-300">{position.buyReason}</span>
        </div>
      )}

      {/* 买入信号 */}
      {position.buySignals && position.buySignals.length > 0 && (
        <div>
          <span className="text-[10px] text-gray-500 block mb-1">买入信号</span>
          <div className="space-y-0.5">
            {position.buySignals.map((sig, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="text-red-400">{sig.label}</span>
                <span className="text-gray-600 font-mono">¥{sig.price}</span>
                <span className={STRATEGY_LABELS[sig.strategy]?.color || "text-gray-500"}>{STRATEGY_LABELS[sig.strategy]?.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 卖出信号 */}
      {position.sellSignals && position.sellSignals.length > 0 && (
        <div>
          <span className="text-[10px] text-gray-500 block mb-1">卖出点</span>
          <div className="space-y-0.5">
            {position.sellSignals.map((sig, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${sig.triggered ? "bg-green-400" : "bg-gray-600"}`} />
                <span className={sig.triggered ? "text-green-400" : "text-gray-400"}>{sig.label}</span>
                <span className="text-gray-600 font-mono">¥{sig.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 清仓信号 */}
      {position.stopLossSignals && position.stopLossSignals.length > 0 && (
        <div>
          <span className="text-[10px] text-gray-500 block mb-1">清仓点</span>
          <div className="space-y-0.5">
            {position.stopLossSignals.map((sig, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${sig.triggered ? "bg-red-400" : "bg-gray-600"}`} />
                <span className={sig.triggered ? "text-red-400" : "text-gray-500"}>{sig.label}</span>
                <span className="text-gray-600 font-mono">¥{sig.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 策略成功率统计面板 =====
function StrategyStatsPanel({ stats }: { stats: SingleStrategyStats[] }) {
  if (stats.length === 0) return <div className="text-center py-4 text-xs text-gray-600">暂无已平仓交易数据</div>;

  return (
    <div className="space-y-2">
      {stats.map((s) => (
        <div key={s.strategy} className="bg-[#111827] rounded p-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-gray-200">{s.label}</span>
            </div>
            <span className={`text-xs font-mono font-bold ${s.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {s.totalPnl >= 0 ? "+" : ""}¥{s.totalPnl.toLocaleString()}
            </span>
          </div>
          {/* 胜率条 */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-2 bg-[#0a0e17] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${s.winRate}%`, backgroundColor: s.color }} />
            </div>
            <span className={`text-[10px] font-mono ${s.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
              {s.winRate}%
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-[10px]">
            <div><span className="text-gray-600">总交易</span><div className="text-gray-300 font-mono">{s.totalTrades}</div></div>
            <div><span className="text-gray-600">盈利</span><div className="text-green-400 font-mono">{s.profitableTrades}</div></div>
            <div><span className="text-gray-600">亏损</span><div className="text-red-400 font-mono">{s.losingTrades}</div></div>
            <div><span className="text-gray-600">盈亏比</span><div className="text-blue-400 font-mono">{s.profitLossRatio}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] mt-1">
            <div className="flex justify-between"><span className="text-gray-600">平均盈利</span><span className="text-green-400 font-mono">+¥{s.avgProfit.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">平均亏损</span><span className="text-red-400 font-mono">-¥{s.avgLoss.toLocaleString()}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== 失败原因分析面板 =====
function FailureAnalysisPanel({ stats }: { stats: FailureStats[] }) {
  if (stats.length === 0) return <div className="text-center py-4 text-xs text-gray-600">暂无亏损交易</div>;

  const totalLoss = stats.reduce((s, f) => s + f.totalLoss, 0);
  const totalCount = stats.reduce((s, f) => s + f.count, 0);

  return (
    <div className="space-y-2">
      {/* 总览 */}
      <div className="bg-[#111827] rounded p-2 flex items-center justify-between">
        <span className="text-[10px] text-gray-500">亏损交易总计</span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-red-400 font-mono">{totalCount}笔</span>
          <span className="text-red-400 font-mono">{totalLoss.toLocaleString()}元</span>
        </div>
      </div>
      {/* 原因分布 */}
      {stats.map((f) => {
        const config = FAILURE_REASON_CONFIG[f.reason];
        const percent = totalCount > 0 ? (f.count / totalCount) * 100 : 0;
        return (
          <div key={f.reason} className={`rounded p-2 border ${config.bg}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                <span className="text-[10px] text-gray-500">{f.count}笔</span>
              </div>
              <span className="text-[10px] text-red-400 font-mono">{f.totalLoss.toLocaleString()}元</span>
            </div>
            {/* 占比条 */}
            <div className="h-1 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: config.color.replace("text-", "").includes("red") ? "#ef4444" : config.color.replace("text-", "").includes("orange") ? "#f97316" : config.color.replace("text-", "").includes("yellow") ? "#eab308" : config.color.replace("text-", "").includes("blue") ? "#3b82f6" : config.color.replace("text-", "").includes("purple") ? "#a855f7" : "#06b6d4" }} />
            </div>
            {/* 涉及交易 */}
            <div className="mt-1 space-y-0.5">
              {f.trades.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400">{t.stockName}</span>
                  <span className="text-red-400 font-mono">{t.pnl?.toLocaleString()}元</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== 交易决策详情 =====
function TradeDecisionDetail({ trade }: { trade: Trade }) {
  if (!trade.decision) return null;
  const d = trade.decision;
  const stratConfig = STRATEGY_LABELS[d.signalSource];

  return (
    <div className="mt-1.5 pt-1.5 border-t border-gray-800/50 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-gray-600">决策来源:</span>
        <span className={stratConfig?.color}>{stratConfig?.label}</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-300">{d.signalLabel}</span>
      </div>
      {d.marketState && (
        <div className="text-[10px] text-gray-500">
          市场状态: {d.marketState}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        {d.supportLevel && <div><span className="text-gray-600">支撑位:</span> <span className="text-green-400 font-mono">¥{d.supportLevel}</span></div>}
        {d.resistanceLevel && <div><span className="text-gray-600">压力位:</span> <span className="text-red-400 font-mono">¥{d.resistanceLevel}</span></div>}
        {d.suggestedPrice && <div><span className="text-gray-600">建议价:</span> <span className="text-blue-400 font-mono">¥{d.suggestedPrice}</span></div>}
        {d.actualPrice && <div><span className="text-gray-600">实际价:</span> <span className="text-gray-300 font-mono">¥{d.actualPrice}</span></div>}
      </div>
      {/* 失败原因标签 */}
      {trade.failureReasons && trade.failureReasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {trade.failureReasons.map((r) => {
            const cfg = FAILURE_REASON_CONFIG[r];
            return (
              <span key={r} className={`text-[8px] px-1 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                {cfg.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== 主面板 =====
export function BacktestPanel({ externalAddStock }: { externalAddStock?: { code: string; name: string } | null }) {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState<"tracking" | "positions" | "trades" | "strategy" | "settings" | "chart" | "history">("tracking");
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ title: string; message: string; confirmText?: string; onConfirm: () => void } | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState<{ code: string; name: string; limit?: number } | null>(null);
  const [showTradeDialog, setShowTradeDialog] = useState<{ code: string; name: string; price: number; direction: "buy" | "sell" } | null>(null);
  
  // 量化策略配置
  const [strategyWeights, setStrategyWeights] = useState<StrategyWeight[]>([]);
  const [tradeThreshold, setTradeThreshold] = useState(70);
  
  // 新增：股票搜索和添加
  const [addStockInput, setAddStockInput] = useState("");
  const [addStockName, setAddStockName] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ code: string; name: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 获取全局状态用于联动
  const { selectedStock } = useAppState();

  const refreshAccounts = useCallback(() => {
    const summaries = getAllAccountSummaries();
    setAccounts(summaries);
    const activeId = getActiveAccountId();
    if (activeId) { setActiveAccountIdState(activeId); const acc = loadAccount(activeId); if (acc) setAccount(acc); }
  }, []);

  useEffect(() => {
    refreshAccounts();
    const allAccounts = getAllAccountSummaries();
    if (allAccounts.length === 0) {
      const demo = generateDemoAccount();
      setActiveAccountId(demo.id); setAccount(demo); setActiveAccountIdState(demo.id); setAccounts(getAllAccountSummaries());
    }
  }, [refreshAccounts]);

  const switchAccount = (id: string) => { setActiveAccountId(id); setActiveAccountIdState(id); const acc = loadAccount(id); if (acc) setAccount(acc); };

  const handleCreateAccount = (name: string, capital: number, accountType: AccountType) => {
    const acc = createAccount(name, capital, accountType);
    setActiveAccountId(acc.id); setActiveAccountIdState(acc.id); setAccount(acc); setAccounts(getAllAccountSummaries());
    setShowCreateDialog(false); addToast("success", `账户"${name}"创建成功${accountType === "quant" ? "（量化回测）" : ""}`);
  };

  const handleDeleteAccount = (id: string, name: string) => {
    setShowConfirmDialog({ title: "删除账户", message: `确定要删除账户"${name}"吗？所有数据将被永久删除。`, confirmText: name,
      onConfirm: () => {
        deleteAccount(id); const remaining = getAllAccountSummaries(); setAccounts(remaining);
        if (remaining.length > 0) switchAccount(remaining[0].id); else { setAccount(null); setActiveAccountIdState(null); }
        setShowConfirmDialog(null); addToast("success", `账户"${name}"已删除`);
      } });
  };

  const addToast = (type: ToastMessage["type"], message: string) => { setToasts((prev) => [...prev, { id: generateId(), type, message }]); };
  const removeToast = (id: string) => { setToasts((prev) => prev.filter((t) => t.id !== id)); };

  const toggleTracking = (code: string) => {
    if (!account) return;
    const updated = { ...account };
    if (updated.trackingList.includes(code)) { updated.trackingList = updated.trackingList.filter((c) => c !== code); addToast("info", "已取消跟踪"); }
    else { updated.trackingList = [...updated.trackingList, code]; addToast("success", "已加入跟踪列表"); }
    saveAccount(updated); setAccount({ ...updated });
  };

  const trackAllPositions = () => {
    if (!account) return;
    const updated = { ...account };
    const posCodes = updated.positions.map((p) => p.stockCode);
    updated.trackingList = Array.from(new Set([...updated.trackingList, ...posCodes]));
    saveAccount(updated); setAccount({ ...updated }); addToast("success", `已跟踪所有持仓 (${posCodes.length}只)`);
  };

  const handleBuySignal = (signal: BuySignal) => {
    if (!account) return;
    if (!account.trackingList.includes(signal.stockCode)) { addToast("warning", `${signal.stockName}未在跟踪列表中`); return; }
    const check = canBuyStock(account, signal.stockCode, signal.amount);
    if (!check.can) { addToast("error", check.reason); return; }
    const updated = executeBuy(account, signal.stockCode, signal.stockName, signal.price, signal.amount, signal.reason, true);
    setAccount({ ...updated }); setAccounts(getAllAccountSummaries()); addToast("success", `自动买入 ${signal.stockName}`);
  };

  const handleManualTrade = (price: number, quantity: number) => {
    if (!account || !showTradeDialog) return;
    const { code, name, direction } = showTradeDialog;
    if (direction === "buy") {
      const amount = price * quantity;
      const check = canBuyStock(account, code, amount);
      if (!check.can) { addToast("error", check.reason); setShowTradeDialog(null); return; }
      const updated = executeBuy(account, code, name, price, amount, "手动买入", false);
      setAccount({ ...updated }); addToast("success", `买入 ${name} ${quantity}股`);
    } else {
      const updated = executeSell(account, code, price, quantity, "手动卖出", false);
      setAccount({ ...updated }); addToast("success", `卖出 ${name} ${quantity}股`);
    }
    setAccounts(getAllAccountSummaries()); setShowTradeDialog(null);
  };

  const handleSaveLimit = (code: string, limit: number) => {
    if (!account) return;
    const updated = { ...account };
    if (limit > 0) updated.stockLimits[code] = limit; else delete updated.stockLimits[code];
    saveAccount(updated); setAccount({ ...updated }); setShowLimitDialog(null);
    addToast("success", limit > 0 ? `额度已设置¥${limit.toLocaleString()}` : "额度限制已取消");
  };

  const handleCleanGarbage = () => {
    if (!account) return;
    const result = cleanGarbageData(account);
    const updated = loadAccount(account.id); if (updated) setAccount({ ...updated });
    setAccounts(getAllAccountSummaries()); addToast("success", `清理完成，删除${result.deletedTrades}条记录`);
  };

  const handleResetAccount = () => {
    if (!account) return;
    setShowConfirmDialog({ title: "重置账户", message: `确定要重置"${account.name}"？持仓和交易记录将被清空。`, confirmText: "重置",
      onConfirm: () => { const updated = resetAccount(account); setAccount({ ...updated }); setAccounts(getAllAccountSummaries()); setShowConfirmDialog(null); addToast("success", "账户已重置"); } });
  };

  const togglePositionExpand = (code: string) => {
    setExpandedPositions((prev) => { const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next; });
  };
  const toggleTradeExpand = (id: string) => {
    setExpandedTrades((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  // 导出交易记录到 CSV
  const exportTradesToCSV = (acc: Account) => {
    const headers = ['日期', '股票代码', '股票名称', '方向', '价格', '数量', '金额', '盈亏', '策略', '原因'];
    const rows = acc.trades.map(t => [
      new Date(t.timestamp).toLocaleDateString(),
      t.stockCode,
      t.stockName,
      t.direction === 'buy' ? '买入' : '卖出',
      t.price.toFixed(2),
      t.quantity.toString(),
      t.amount.toFixed(2),
      t.pnl !== undefined ? t.pnl.toFixed(2) : '',
      t.strategy || '',
      `"${(t.reason || '').replace(/"/g, '""')}"`,
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${acc.name}_交易记录_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== 新增：股票搜索功能 =====
  const searchStockForAdd = useCallback(async (keyword: string) => {
    if (!keyword.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/stock?action=search&keyword=${encodeURIComponent(keyword.trim())}`);
      const data = await res.json();
      if (data.stocks) {
        setSearchResults(data.stocks.slice(0, 8).map((s: { code: string; name: string }) => ({ code: s.code, name: s.name })));
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    }
    setIsSearching(false);
  }, []);

  // 添加跟踪股票（手动输入）
  const handleAddTrackingStock = (code: string, name: string) => {
    if (!account) return;
    if (account.trackingList.includes(code)) {
      addToast("warning", `${name || code}已在跟踪列表中`);
      return;
    }
    const updated = { ...account };
    updated.trackingList = [...updated.trackingList, code];
    saveAccount(updated);
    setAccount({ ...updated });
    setAddStockInput("");
    setAddStockName("");
    setSearchResults([]);
    addToast("success", `已添加 ${name || code} 到跟踪列表`);
  };

  // ===== 新增：数据导出功能 =====
  const handleExportData = () => {
    if (!account) return;
    const exportData = {
      version: "1.0",
      exportTime: new Date().toISOString(),
      account: account,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backtest_${account.name}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("success", "数据已导出");
  };

  // ===== 新增：数据导入功能 =====
  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !account) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.account && data.account.id) {
          const importedAccount = data.account as Account;
          // 保留当前账户ID，但导入其他数据
          const updated: Account = {
            ...account,
            positions: importedAccount.positions || [],
            trades: importedAccount.trades || [],
            trackingList: importedAccount.trackingList || [],
            stockLimits: importedAccount.stockLimits || {},
            equityCurve: importedAccount.equityCurve || [],
          };
          saveAccount(updated);
          setAccount({ ...updated });
          setAccounts(getAllAccountSummaries());
          addToast("success", `数据导入成功：${importedAccount.positions?.length || 0}个持仓，${importedAccount.trades?.length || 0}条交易`);
        } else {
          addToast("error", "导入文件格式不正确");
        }
      } catch {
        addToast("error", "导入文件解析失败");
      }
    };
    reader.readAsText(file);
    // 重置input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ===== 新增：处理外部添加股票（分析面板联动） =====
  useEffect(() => {
    if (externalAddStock && account) {
      handleAddTrackingStock(externalAddStock.code, externalAddStock.name);
    }
  }, [externalAddStock]);

  // ===== 新增：添加当前选中股票到跟踪 =====
  const handleAddCurrentStockToTracking = () => {
    if (!selectedStock || !account) return;
    handleAddTrackingStock(selectedStock.code, selectedStock.name);
  };

  const metrics = account ? calculateMetrics(account) : null;
  const totalAssets = account ? getTotalAssets(account) : 0;
  const totalPnl = account ? totalAssets - account.initialCapital : 0;
  const totalPnlPercent = account && account.initialCapital > 0 ? (totalPnl / account.initialCapital) * 100 : 0;
  const marketValue = account ? account.positions.reduce((s, p) => s + p.marketValue, 0) : 0;
  const equityCurve = account ? generateEquityCurve(account) : [];
  const strategyStats = account ? calculateStrategyStats(account) : [];
  const failureStats = account ? calculateFailureStats(account) : [];
  const benchmarkData = account ? calculateBenchmarkComparison(account) : [];
  const consecutiveLosses = account ? calculateConsecutiveLosses(account) : { current: 0, max: 0 };
  const maxDrawdownPeriod = account ? calculateMaxDrawdownPeriod(account) : null;
  const maxDailyLoss = account ? calculateMaxDailyLoss(account) : null;
  const slippageStats = account ? calculateSlippageStats(account) : null;

  // 风险检测
  const positionRatio = totalAssets > 0 ? (marketValue / totalAssets) * 100 : 0;
  const hasRiskAlert = positionRatio > 70 || totalPnlPercent < -5;
  const [now] = useState(() => Date.now());

  const tabs = [
    { id: "tracking" as const, label: "跟踪", count: account?.trackingList.length || 0 },
    { id: "positions" as const, label: "持仓", count: account?.positions.length || 0 },
    { id: "trades" as const, label: "交易", count: account?.trades.length || 0 },
    { id: "chart" as const, label: "资金曲线" },
    { id: "history" as const, label: "历史回测" },
    { id: "strategy" as const, label: "策略" },
    { id: "settings" as const, label: "设置" },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0e17] text-gray-200">
      <Toast toasts={toasts} onRemove={removeToast} />
      {showCreateDialog && <CreateAccountDialog onCreate={handleCreateAccount} onCancel={() => setShowCreateDialog(false)} />}
      {showConfirmDialog && <ConfirmDialog title={showConfirmDialog.title} message={showConfirmDialog.message} confirmText={showConfirmDialog.confirmText} onConfirm={showConfirmDialog.onConfirm} onCancel={() => setShowConfirmDialog(null)} />}
      {showLimitDialog && <StockLimitDialog stockCode={showLimitDialog.code} stockName={showLimitDialog.name} currentLimit={showLimitDialog.limit} onSave={handleSaveLimit} onCancel={() => setShowLimitDialog(null)} />}
      {showTradeDialog && account && <TradeDialog stockCode={showTradeDialog.code} stockName={showTradeDialog.name} currentPrice={showTradeDialog.price} direction={showTradeDialog.direction} availableCapital={account.currentCapital} onExecute={handleManualTrade} onCancel={() => setShowTradeDialog(null)} />}

      {/* 风险警示条 */}
      {account && hasRiskAlert && (
        <div className="px-2 py-1 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] text-red-400">
            {positionRatio > 70 ? `仓位过重(${positionRatio.toFixed(0)}%)，注意风险` : `累计亏损${totalPnlPercent.toFixed(1)}%，建议降低仓位`}
          </span>
        </div>
      )}

      {/* 交易状态指示器 */}
      <div className="px-2 py-1 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <TradingStatusIndicator />
        {account?.type === 'quant' && account?.strategy?.autoTrade && (
          <span className="text-[10px] text-purple-400">量化自动交易已启用</span>
        )}
      </div>

      {/* 顶部：账户管理 */}
      <div className="p-2 border-b border-gray-800 bg-[#111827] flex-shrink-0">
        <div className="flex items-center gap-1 mb-2 overflow-x-auto">
          {accounts.map((acc) => (
            <button key={acc.id} onClick={() => switchAccount(acc.id)}
              className={`px-2 py-1 text-[10px] rounded whitespace-nowrap transition-colors ${acc.id === activeAccountId ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-gray-800/50 text-gray-500 hover:text-gray-300"}`}>
              {acc.name}
            </button>
          ))}
          <button onClick={() => setShowCreateDialog(true)} className="px-2 py-1 text-[10px] text-gray-500 hover:text-blue-400">+ 新建</button>
        </div>
        {account && (
          <div className="grid grid-cols-4 gap-2">
            <div><div className="text-[10px] text-gray-500">总资产</div><div className={`text-xs font-mono font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>¥{totalAssets.toLocaleString()}</div></div>
            <div><div className="text-[10px] text-gray-500">可用</div><div className="text-xs font-mono text-gray-300">¥{account.currentCapital.toLocaleString()}</div></div>
            <div><div className="text-[10px] text-gray-500">盈亏</div><div className={`text-xs font-mono font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{totalPnl >= 0 ? "+" : ""}{totalPnlPercent.toFixed(2)}%</div></div>
            <div><div className="text-[10px] text-gray-500">仓位</div><div className={`text-xs font-mono ${positionRatio > 70 ? "text-red-400" : "text-yellow-400"}`}>{positionRatio.toFixed(1)}%</div></div>
          </div>
        )}
      </div>

      {/* 量化账户策略配置区域 */}
      {account?.type === 'quant' && (
        <div className="border-b border-gray-800 p-2 bg-[#0f1419]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-purple-400">📊 量化策略</span>
              <span className="text-[9px] text-gray-500">{strategyWeights.filter(s => s.enabled).length}个已启用</span>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="text-[9px] text-blue-400 hover:text-blue-300"
            >
              配置策略 →
            </button>
          </div>
          
          {strategyWeights.filter(s => s.enabled).length === 0 ? (
            <div className="text-center py-2">
              <p className="text-[9px] text-gray-500 mb-2">暂未配置策略</p>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-2 py-1 text-[9px] bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30"
              >
                添加策略
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {strategyWeights.filter(s => s.enabled).map((sw) => (
                <div key={sw.strategyId} className="flex items-center justify-between bg-[#111827] rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-300">{sw.strategyName}</span>
                    <span className="text-[8px] text-gray-500">权重{sw.weight}%</span>
                  </div>
                  <span className={`text-[8px] ${sw.confidence >= 70 ? 'text-green-400' : sw.confidence >= 50 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    置信度{sw.confidence}%
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[8px] text-gray-500">交易阈值: {tradeThreshold}分</span>
                <button
                  onClick={() => {
                    // 模拟运行策略
                    addToast('info', '策略运行中 - 正在根据实时价格和策略信号进行分析...');
                  }}
                  className="px-2 py-0.5 text-[9px] bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                >
                  ▶ 运行策略
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab切换 */}
      <div className="flex border-b border-gray-800 flex-shrink-0">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-1.5 text-[10px] transition-colors relative ${activeTab === tab.id ? "text-blue-400 border-b border-blue-400" : "text-gray-500 hover:text-gray-300"}`}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && <span className="ml-1 text-[8px] bg-gray-700 text-gray-400 px-1 rounded">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {!account ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 mb-3">暂无账户</p>
            <button onClick={() => setShowCreateDialog(true)} className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30">创建账户</button>
          </div>
        ) : (
          <>
            {/* 跟踪列表 */}
            {activeTab === "tracking" && (
              <div className="p-2">
                {/* 添加股票输入框 */}
                <div className="mb-3 bg-[#0a0e17] rounded p-2 border border-gray-800">
                  <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    添加跟踪股票
                  </div>
                  <div className="flex gap-1.5">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={addStockInput}
                        onChange={(e) => { setAddStockInput(e.target.value); searchStockForAdd(e.target.value); }}
                        placeholder="输入股票代码或名称"
                        className="w-full px-2 py-1.5 bg-[#111827] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500 pr-6"
                      />
                      {addStockInput && (
                        <button onClick={() => { setAddStockInput(""); setSearchResults([]); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (addStockInput.trim()) {
                          // 如果搜索结果存在，使用第一个；否则直接添加输入的代码
                          if (searchResults.length > 0) {
                            handleAddTrackingStock(searchResults[0].code, searchResults[0].name);
                          } else {
                            handleAddTrackingStock(addStockInput.trim(), addStockName || addStockInput.trim());
                          }
                        }
                      }}
                      disabled={!addStockInput.trim()}
                      className="px-2.5 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 disabled:opacity-40 whitespace-nowrap"
                    >
                      添加
                    </button>
                  </div>
                  {/* 搜索结果下拉 */}
                  {searchResults.length > 0 && (
                    <div className="mt-1.5 bg-[#111827] border border-gray-700 rounded max-h-32 overflow-y-auto">
                      {searchResults.map((s) => (
                        <button
                          key={s.code}
                          onClick={() => handleAddTrackingStock(s.code, s.name)}
                          className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-[#1a2332] flex items-center justify-between border-b border-gray-800 last:border-0"
                        >
                          <span className="text-gray-200">{s.name}</span>
                          <span className="text-gray-500">{s.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {isSearching && <div className="text-[10px] text-gray-600 mt-1">搜索中...</div>}
                  {/* 快捷添加当前选中股票 */}
                  {selectedStock && !account?.trackingList.includes(selectedStock.code) && (
                    <button
                      onClick={handleAddCurrentStockToTracking}
                      className="mt-1.5 w-full px-2 py-1 text-[10px] text-left bg-blue-500/5 border border-blue-500/20 rounded text-blue-400 hover:bg-blue-500/10"
                    >
                      + 添加当前分析股票：{selectedStock.name} ({selectedStock.code})
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500">跟踪列表 ({account.trackingList.length})</span>
                  {account.positions.length > 0 && <button onClick={trackAllPositions} className="text-[10px] text-blue-400 hover:text-blue-300">跟踪所有持仓</button>}
                </div>
                {account.trackingList.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-800/50 flex items-center justify-center">
                      <Search className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-500 mb-1">暂无跟踪股票</p>
                    <p className="text-[10px] text-gray-600 mb-2">在上方输入框添加股票，或从分析面板一键加入</p>
                    <div className="text-[10px] text-gray-700 space-y-0.5">
                      <p>• 输入股票代码或名称搜索添加</p>
                      <p>• 点击"添加当前分析股票"快速加入</p>
                      <p>• 点击"跟踪所有持仓"批量添加</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {account.trackingList.map((code) => {
                      const pos = account.positions.find((p) => p.stockCode === code);
                      const limit = account.stockLimits[code];
                      return (
                        <div key={code} className="bg-[#111827] rounded p-2 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-200 truncate">{pos?.stockName || code}</span>
                              <span className="text-[10px] text-gray-600">{code}</span>
                              {limit && <span className="text-[8px] text-yellow-500/70 bg-yellow-500/10 px-1 rounded">限额¥{(limit / 10000).toFixed(0)}万</span>}
                            </div>
                            {pos && <div className="flex items-center gap-3 mt-1 text-[10px]"><span className="text-gray-500">持仓{pos.quantity}股</span><span className={pos.pnl >= 0 ? "text-green-400" : "text-red-400"}>{pos.pnl >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(2)}%</span></div>}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setShowTradeDialog({ code, name: pos?.stockName || code, price: pos?.currentPrice || 0, direction: "buy" })} className="px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-400 rounded hover:bg-red-500/20">买</button>
                            {pos && <button onClick={() => setShowTradeDialog({ code, name: pos.stockName, price: pos.currentPrice, direction: "sell" })} className="px-1.5 py-0.5 text-[10px] bg-green-500/10 text-green-400 rounded hover:bg-green-500/20">卖</button>}
                            <button onClick={() => toggleTracking(code)} className="px-1.5 py-0.5 text-[10px] text-gray-600 hover:text-red-400">×</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* 模拟信号 */}
                <div className="mt-3 border-t border-gray-800 pt-3">
                  <div className="text-[10px] text-gray-500 mb-2">模拟信号演示</div>
                  <div className="space-y-1">
                    <button onClick={() => handleBuySignal({ stockCode: "688256", stockName: "寒武纪", price: 285.5, amount: 28550, reason: "缠论三买+AI算力", strategy: "chanlun" })}
                      className="w-full text-left px-2 py-1.5 bg-[#111827] rounded text-[10px] hover:bg-[#1a2332]">
                      <div className="flex items-center justify-between"><span className="text-red-400">买入信号</span><span className="text-gray-400">寒武纪 688256</span></div>
                      <div className="text-gray-600 mt-0.5">¥285.50 x 100股 | 缠论三买</div>
                    </button>
                    <button onClick={() => handleBuySignal({ stockCode: "002475", stockName: "立讯精密", price: 38.2, amount: 38200, reason: "波浪第3浪+消费电子", strategy: "wave" })}
                      className="w-full text-left px-2 py-1.5 bg-[#111827] rounded text-[10px] hover:bg-[#1a2332]">
                      <div className="flex items-center justify-between"><span className="text-red-400">买入信号</span><span className="text-gray-400">立讯精密 002475</span></div>
                      <div className="text-gray-600 mt-0.5">¥38.20 x 1000股 | 波浪第3浪</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 持仓 */}
            {activeTab === "positions" && (
              <div className="p-2">
                {account.positions.length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-500">持仓列表 ({account.positions.length})</span>
                    <button 
                      onClick={() => { const updated = loadAccount(account.id); if (updated) { setAccount({ ...updated }); addToast("success", "持仓已刷新"); } }}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      刷新持仓
                    </button>
                  </div>
                )}
                {account.positions.length === 0 ? (
                  <div className="text-center py-8"><p className="text-xs text-gray-600">暂无持仓</p></div>
                ) : (
                  <div className="space-y-2">
                    {account.positions.map((pos) => {
                      const isTracking = account.trackingList.includes(pos.stockCode);
                      const limit = account.stockLimits[pos.stockCode];
                      const isExpanded = expandedPositions.has(pos.stockCode);
                      const holdingDays = pos.buyTime ? Math.floor((now - pos.buyTime) / 86400000) : (pos.holdingDays || 0);
                      return (
                        <div key={pos.stockCode} className="bg-[#111827] rounded p-2">
                          <div className="flex items-center justify-between mb-1 cursor-pointer" onClick={() => togglePositionExpand(pos.stockCode)}>
                            <div className="flex items-center gap-1.5">
                              <svg className={`w-3 h-3 text-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              <span className="text-xs text-gray-200">{pos.stockName}</span>
                              <span className="text-[10px] text-gray-600">{pos.stockCode}</span>
                              {isTracking && <span className="text-[8px] text-blue-400 bg-blue-400/10 px-1 rounded">跟踪</span>}
                              {pos.strategy && <span className={`text-[8px] ${STRATEGY_LABELS[pos.strategy]?.color} bg-gray-800 px-1 rounded`}>{STRATEGY_LABELS[pos.strategy]?.label}</span>}
                            </div>
                            <span className={`text-xs font-mono font-bold ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{pos.pnl >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(2)}%</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1 text-[10px] mb-1">
                            <div><span className="text-gray-600">持仓</span><div className="text-gray-300 font-mono">{pos.quantity}股</div></div>
                            <div><span className="text-gray-600">成本</span><div className="text-gray-300 font-mono">¥{pos.avgCost.toFixed(2)}</div></div>
                            <div><span className="text-gray-600">现价</span><div className="text-gray-300 font-mono">¥{pos.currentPrice.toFixed(2)}</div></div>
                            <div><span className="text-gray-600">盈亏</span><div className={`font-mono ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{pos.pnl >= 0 ? "+" : ""}¥{pos.pnl.toLocaleString()}</div></div>
                            <div><span className="text-gray-600">天数</span><div className="text-yellow-400 font-mono">{holdingDays}天</div></div>
                          </div>
                          {limit && (
                            <div className="mb-1">
                              <div className="flex justify-between text-[8px] text-gray-600 mb-0.5"><span>额度</span><span>¥{pos.marketValue.toLocaleString()}/¥{limit.toLocaleString()}</span></div>
                              <div className="h-1 bg-[#0a0e17] rounded-full overflow-hidden"><div className={`h-full rounded-full ${(pos.marketValue / limit) > 0.8 ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, (pos.marketValue / limit) * 100)}%` }} /></div>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <div className="flex-1 bg-[#0a0e17] rounded-full h-1"><div className="bg-blue-500/50 h-1 rounded-full" style={{ width: `${pos.positionPercent}%` }} /></div>
                            <span className="text-[8px] text-gray-600">{pos.positionPercent}%</span>
                            <button onClick={() => setShowTradeDialog({ code: pos.stockCode, name: pos.stockName, price: pos.currentPrice, direction: "sell" })} className="px-1.5 py-0.5 text-[10px] bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 ml-1">卖出</button>
                            <button onClick={() => toggleTracking(pos.stockCode)} className={`px-1.5 py-0.5 text-[10px] rounded ${isTracking ? "bg-blue-500/10 text-blue-400" : "bg-gray-800 text-gray-600 hover:text-blue-400"}`}>{isTracking ? "已跟踪" : "跟踪"}</button>
                            <button onClick={() => setShowLimitDialog({ code: pos.stockCode, name: pos.stockName, limit })} className="px-1.5 py-0.5 text-[10px] bg-gray-800 text-gray-500 rounded hover:text-yellow-400">额度</button>
                          </div>
                          {/* 展开详情 */}
                          {isExpanded && <PositionDetail position={pos} account={account} now={now} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 交易记录 */}
            {activeTab === "trades" && (
              <div className="p-2">
                {account.trades.length > 0 && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => exportTradesToCSV(account)}
                      className="text-[10px] text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      导出CSV
                    </button>
                  </div>
                )}
                {account.trades.length === 0 ? (
                  <div className="text-center py-8"><p className="text-xs text-gray-600">暂无交易记录</p></div>
                ) : (
                  <div className="space-y-1">
                    {[...account.trades].reverse().map((trade) => {
                      const isExpanded = expandedTrades.has(trade.id);
                      const stratConfig = trade.strategy ? STRATEGY_LABELS[trade.strategy] : null;
                      return (
                        <div key={trade.id} className="bg-[#111827] rounded p-2">
                          <div className="flex items-center justify-between mb-0.5 cursor-pointer" onClick={() => toggleTradeExpand(trade.id)}>
                            <div className="flex items-center gap-1.5">
                              <svg className={`w-2.5 h-2.5 text-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              <span className={`text-[10px] px-1 py-0.5 rounded ${trade.direction === "buy" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>{trade.direction === "buy" ? "买" : "卖"}</span>
                              <span className="text-xs text-gray-200">{trade.stockName}</span>
                              {trade.isAuto && <span className="text-[8px] text-purple-400 bg-purple-400/10 px-1 rounded">自动</span>}
                              {stratConfig && <span className={`text-[8px] ${stratConfig.color} bg-gray-800 px-1 rounded`}>{stratConfig.label}</span>}
                            </div>
                            {trade.pnl !== undefined && <span className={`text-[10px] font-mono ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{trade.pnl >= 0 ? "+" : ""}¥{trade.pnl.toLocaleString()}</span>}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-gray-600">
                            <span>{new Date(trade.timestamp).toLocaleDateString()}</span>
                            <span>¥{trade.price.toFixed(2)} x {trade.quantity}股 = ¥{trade.amount.toLocaleString()}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{trade.reason}</div>
                          {/* 展开决策详情 */}
                          {isExpanded && <TradeDecisionDetail trade={trade} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 策略分析 */}
            {activeTab === "strategy" && metrics && (
              <div className="p-2 space-y-3">
                {/* 总体指标 */}
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-[#111827] rounded p-2 text-center">
                    <div className="text-[8px] text-gray-600">累计收益</div>
                    <div className={`text-xs font-mono font-bold ${metrics.totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>{metrics.totalReturn >= 0 ? "+" : ""}{metrics.totalReturn}%</div>
                  </div>
                  <div className="bg-[#111827] rounded p-2 text-center">
                    <div className="text-[8px] text-gray-600">最大回撤</div>
                    <div className="text-xs font-mono font-bold text-red-400">{metrics.maxDrawdown}%</div>
                  </div>
                  <div className="bg-[#111827] rounded p-2 text-center">
                    <div className="text-[8px] text-gray-600">胜率</div>
                    <div className={`text-xs font-mono ${metrics.winRate >= 50 ? "text-green-400" : "text-yellow-400"}`}>{metrics.winRate}%</div>
                  </div>
                </div>

                {/* 资金曲线 */}
                {equityCurve.length > 0 && (
                  <div className="bg-[#111827] rounded p-2">
                    <div className="text-[10px] text-gray-500 mb-1">资金走势</div>
                    <div className="h-24 relative">
                      <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                        <defs><linearGradient id="eqG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0" /></linearGradient></defs>
                        {(() => {
                          const vals = equityCurve.map((p) => p.totalAssets);
                          const min = Math.min(...vals) * 0.999; const max = Math.max(...vals) * 1.001; const range = max - min || 1;
                          const pts = equityCurve.map((p, i) => `${(i / (equityCurve.length - 1)) * 300} ${80 - ((p.totalAssets - min) / range) * 80}`);
                          return (<><path d={`M 0 80 L ${pts.join(" L ")} L 300 80 Z`} fill="url(#eqG2)" /><path d={`M ${pts.join(" L ")}`} fill="none" stroke="#22c55e" strokeWidth="1.5" /></>);
                        })()}
                      </svg>
                    </div>
                  </div>
                )}

                {/* 策略成功率 */}
                <div>
                  <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1.5">
                    <span>策略成功率</span>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-gray-600 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-[#0f0f1a] border-gray-700"><p className="text-xs text-gray-300">按策略来源统计已平仓交易的盈亏情况</p></TooltipContent>
                    </Tooltip></TooltipProvider>
                  </div>
                  <StrategyStatsPanel stats={strategyStats} />
                </div>

                {/* 失败原因分析 */}
                <div>
                  <div className="text-[10px] text-gray-500 mb-1.5">失败原因分析</div>
                  <FailureAnalysisPanel stats={failureStats} />
                </div>

                {/* 基准对比 */}
                {benchmarkData.length > 0 && (
                  <div className="bg-[#111827] rounded p-2">
                    <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1.5">
                      <span>基准对比</span>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-gray-600 cursor-help" /></TooltipTrigger>
                        <TooltipContent className="bg-[#0f0f1a] border-gray-700"><p className="text-xs text-gray-300">策略 vs 沪深300 vs 买入持有</p></TooltipContent>
                      </Tooltip></TooltipProvider>
                    </div>
                    <div className="h-28 relative">
                      <svg className="w-full h-full" viewBox="0 0 300 90" preserveAspectRatio="none">
                        {(() => {
                          const allVals = benchmarkData.flatMap(d => [d.strategyReturn, d.benchmarkReturn, d.buyHoldReturn]);
                          const min = Math.min(...allVals) * 1.1;
                          const max = Math.max(...allVals) * 1.1;
                          const range = max - min || 1;
                          const toPath = (vals: number[]) => vals.map((v, i) => `${(i / (vals.length - 1)) * 300} ${90 - ((v - min) / range) * 90}`);
                          const strategyPts = toPath(benchmarkData.map(d => d.strategyReturn));
                          const benchmarkPts = toPath(benchmarkData.map(d => d.benchmarkReturn));
                          const buyHoldPts = toPath(benchmarkData.map(d => d.buyHoldReturn));
                          return (
                            <>
                              {/* Zero line */}
                              <line x1="0" y1={90 - ((0 - min) / range) * 90} x2="300" y2={90 - ((0 - min) / range) * 90} stroke="#374151" strokeWidth="0.5" strokeDasharray="4 2" />
                              {/* Benchmark (CSI 300) */}
                              <path d={`M ${benchmarkPts.join(" L ")}`} fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
                              {/* Buy & Hold */}
                              <path d={`M ${buyHoldPts.join(" L ")}`} fill="none" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
                              {/* Strategy */}
                              <path d={`M ${strategyPts.join(" L ")}`} fill="none" stroke="#22c55e" strokeWidth="1.5" />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="w-3 h-0.5 bg-green-500 inline-block rounded"></span>策略</span>
                      <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="w-3 h-0.5 bg-yellow-500 inline-block rounded" style={{borderTop: '1px dashed #f59e0b'}}></span>沪深300</span>
                      <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="w-3 h-0.5 bg-purple-500 inline-block rounded" style={{borderTop: '1px dashed #8b5cf6'}}></span>买入持有</span>
                    </div>
                    {/* 超额收益 */}
                    {benchmarkData.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        <div className="text-center">
                          <div className="text-[8px] text-gray-600">vs 沪深300</div>
                          <div className={`text-[10px] font-mono font-bold ${(benchmarkData[benchmarkData.length-1].strategyReturn - benchmarkData[benchmarkData.length-1].benchmarkReturn) >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {(benchmarkData[benchmarkData.length-1].strategyReturn - benchmarkData[benchmarkData.length-1].benchmarkReturn) >= 0 ? "+" : ""}{(benchmarkData[benchmarkData.length-1].strategyReturn - benchmarkData[benchmarkData.length-1].benchmarkReturn).toFixed(2)}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[8px] text-gray-600">vs 买入持有</div>
                          <div className={`text-[10px] font-mono font-bold ${(benchmarkData[benchmarkData.length-1].strategyReturn - benchmarkData[benchmarkData.length-1].buyHoldReturn) >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {(benchmarkData[benchmarkData.length-1].strategyReturn - benchmarkData[benchmarkData.length-1].buyHoldReturn) >= 0 ? "+" : ""}{(benchmarkData[benchmarkData.length-1].strategyReturn - benchmarkData[benchmarkData.length-1].buyHoldReturn).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 风控指标 */}
                <div className="bg-[#111827] rounded p-2">
                  <div className="text-[10px] text-gray-500 mb-1.5">风控指标</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="text-center">
                      <div className="text-[8px] text-gray-600">连续亏损</div>
                      <div className={`text-xs font-mono font-bold ${consecutiveLosses.current > 0 ? "text-red-400" : "text-gray-400"}`}>
                        {consecutiveLosses.current}次 <span className="text-[8px] text-gray-600">(最多{consecutiveLosses.max})</span>
                      </div>
                    </div>
                    {maxDrawdownPeriod && (
                      <div className="text-center">
                        <div className="text-[8px] text-gray-600">最大回撤区间</div>
                        <div className="text-[9px] font-mono text-red-400">
                          {maxDrawdownPeriod.start.slice(5)}~{maxDrawdownPeriod.end.slice(5)}
                        </div>
                        <div className="text-[8px] text-red-400">-{maxDrawdownPeriod.drawdown}%</div>
                      </div>
                    )}
                    {maxDailyLoss && (
                      <div className="text-center">
                        <div className="text-[8px] text-gray-600">单日最大亏损</div>
                        <div className="text-[9px] font-mono text-red-400">{maxDailyLoss.date.slice(5)}</div>
                        <div className="text-[10px] font-mono text-red-400">¥{maxDailyLoss.loss.toLocaleString()}</div>
                      </div>
                    )}
                    {slippageStats && (
                      <div className="text-center">
                        <div className="text-[8px] text-gray-600">平均滑点</div>
                        <div className="text-xs font-mono text-yellow-400">{slippageStats.avgSlippage}%</div>
                        <div className="text-[8px] text-gray-600">成本 ¥{slippageStats.totalSlippageCost.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 资金曲线 */}
            {activeTab === "chart" && (
              <div className="p-2 space-y-3">
                {account && account.trades.length > 0 ? (
                  <>
                    {/* 资金曲线图 */}
                    <div className="bg-[#111827] rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-gray-500">资金曲线</span>
                        <div className="flex items-center gap-3 text-[9px]">
                          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block"></span>策略</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-500 inline-block"></span>沪深300</span>
                        </div>
                      </div>
                      <EquityCurveChart account={account} />
                    </div>

                    {/* 关键指标 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#111827] rounded p-2">
                        <div className="text-[9px] text-gray-500">累计收益</div>
                        <div className={`text-sm font-mono font-bold ${totalPnl >= 0 ? "text-red-400" : "text-green-400"}`}>
                          {totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-[#111827] rounded p-2">
                        <div className="text-[9px] text-gray-500">收益率</div>
                        <div className={`text-sm font-mono font-bold ${totalPnlPercent >= 0 ? "text-red-400" : "text-green-400"}`}>
                          {totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-[#111827] rounded p-2">
                        <div className="text-[9px] text-gray-500">最大回撤</div>
                        <div className="text-sm font-mono font-bold text-orange-400">
                          {metrics?.maxDrawdown.toFixed(2) ?? '0.00'}%
                        </div>
                      </div>
                      <div className="bg-[#111827] rounded p-2">
                        <div className="text-[9px] text-gray-500">夏普比率</div>
                        <div className="text-sm font-mono font-bold text-blue-400">
                          {metrics?.sharpeRatio.toFixed(2) ?? '0.00'}
                        </div>
                      </div>
                    </div>

                    {/* 交易标记说明 */}
                    <div className="bg-[#111827] rounded p-2">
                      <div className="text-[10px] text-gray-500 mb-2">交易标记</div>
                      <div className="flex flex-wrap gap-2 text-[9px]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>买入</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>卖出</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500/50 ring-2 ring-green-500/30"></span>盈利</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/50 ring-2 ring-red-500/30"></span>亏损</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-[10px]">
                    暂无交易记录，无法生成资金曲线
                  </div>
                )}
              </div>
            )}

            {/* 历史回测 */}
            {activeTab === "history" && (
              <div className="h-full">
                <HistoryBacktestPanel />
              </div>
            )}

            {/* 设置 */}
            {activeTab === "settings" && (
              <div className="p-2 space-y-3">
                <div className="bg-[#111827] rounded p-2">
                  <div className="text-[10px] text-gray-500 mb-2">账户信息</div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between"><span className="text-gray-600">名称</span><span className="text-gray-300">{account.name}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">初始资金</span><span className="text-gray-300 font-mono">¥{account.initialCapital.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">创建时间</span><span className="text-gray-300">{new Date(account.createdAt).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">跟踪</span><span className="text-blue-400">{account.trackingList.length}只</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">额度</span><span className="text-yellow-400">{Object.keys(account.stockLimits).length}只</span></div>
                  </div>
                </div>
                {/* 量化策略配置 */}
                {account.type === 'quant' && (
                  <StrategySelector
                    selectedStrategies={strategyWeights}
                    onChange={setStrategyWeights}
                    tradeThreshold={tradeThreshold}
                    onThresholdChange={setTradeThreshold}
                  />
                )}
                <div className="bg-[#111827] rounded p-2">
                  <div className="text-[10px] text-gray-500 mb-2">额度管理</div>
                  {Object.keys(account.stockLimits).length === 0 ? <p className="text-[10px] text-gray-600">暂未设置</p> : (
                    <div className="space-y-1">
                      {Object.entries(account.stockLimits).map(([code, limit]) => {
                        const pos = account.positions.find((p) => p.stockCode === code);
                        return (
                          <div key={code} className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-400">{pos?.stockName || code}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-mono">¥{limit.toLocaleString()}</span>
                              <button onClick={() => setShowLimitDialog({ code, name: pos?.stockName || code, limit })} className="text-blue-400 hover:text-blue-300">编辑</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="bg-[#111827] rounded p-2">
                  <div className="text-[10px] text-gray-500 mb-2">数据管理</div>
                  <div className="space-y-2">
                    {/* 导出/导入功能 */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleExportData}
                        className="flex-1 px-2 py-1.5 text-[10px] bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        导出数据
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 px-2 py-1.5 text-[10px] bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 flex items-center justify-center gap-1"
                      >
                        <Upload className="w-3 h-3" />
                        导入数据
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleImportData}
                        className="hidden"
                      />
                    </div>
                    <button onClick={handleCleanGarbage} className="w-full px-2 py-1.5 text-[10px] text-left bg-[#0a0e17] rounded hover:bg-[#1a2332]">
                      <div className="flex items-center justify-between"><span className="text-yellow-400">清理垃圾数据</span><span className="text-gray-600">删除已平仓30天+</span></div>
                    </button>
                    <button onClick={handleResetAccount} className="w-full px-2 py-1.5 text-[10px] text-left bg-[#0a0e17] rounded hover:bg-[#1a2332]">
                      <div className="flex items-center justify-between"><span className="text-red-400">重置账户</span><span className="text-gray-600">清空持仓和交易</span></div>
                    </button>
                    {accounts.length > 1 && (
                      <button onClick={() => handleDeleteAccount(account.id, account.name)} className="w-full px-2 py-1.5 text-[10px] text-left bg-[#0a0e17] rounded hover:bg-red-500/5">
                        <div className="flex items-center justify-between"><span className="text-red-500">删除此账户</span><span className="text-gray-600">永久删除</span></div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
