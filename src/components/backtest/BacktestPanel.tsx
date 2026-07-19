"use client";

import { useState, useEffect, useCallback } from "react";
import type { Account, AccountSummary, ToastMessage, BuySignal } from "./types";
import {
  getAllAccountSummaries,
  loadAccount,
  createAccount,
  deleteAccount,
  getActiveAccountId,
  setActiveAccountId,
  saveAccount,
  calculateMetrics,
  getTotalAssets,
  generateEquityCurve,
  canBuyStock,
  executeBuy,
  executeSell,
  cleanGarbageData,
  resetAccount,
  generateDemoAccount,
  generateId,
} from "./storage";

// Toast通知组件
function Toast({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: string) => void }) {
  useEffect(() => {
    toasts.forEach((t) => {
      const timer = setTimeout(() => onRemove(t.id), 3000);
      return () => clearTimeout(timer);
    });
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
        <div
          key={t.id}
          className={`px-3 py-2 rounded border text-xs ${colorMap[t.type]} animate-pulse`}
          onClick={() => onRemove(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// 确认对话框
function ConfirmDialog({
  title,
  message,
  confirmText,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  const needConfirm = confirmText !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#111827] border border-gray-700 rounded p-4 w-80">
        <h3 className="text-sm font-medium text-white mb-2">{title}</h3>
        <p className="text-xs text-gray-400 mb-3">{message}</p>
        {needConfirm && (
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`请输入"${confirmText}"确认`}
            className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 mb-3 focus:outline-none focus:border-blue-500"
          />
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={needConfirm && input !== confirmText}
            className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

// 新建账户对话框
function CreateAccountDialog({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, capital: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [capital, setCapital] = useState("1000000");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#111827] border border-gray-700 rounded p-4 w-80">
        <h3 className="text-sm font-medium text-white mb-3">新建账户</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">账户名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 短线账户"
              className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">初始资金</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => name.trim() && onCreate(name.trim(), Number(capital) || 1000000)}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-40"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

// 买入额度设置对话框
function StockLimitDialog({
  stockCode,
  stockName,
  currentLimit,
  onSave,
  onCancel,
}: {
  stockCode: string;
  stockName: string;
  currentLimit?: number;
  onSave: (code: string, limit: number) => void;
  onCancel: () => void;
}) {
  const [limit, setLimit] = useState(currentLimit?.toString() || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#111827] border border-gray-700 rounded p-4 w-80">
        <h3 className="text-sm font-medium text-white mb-1">设置买入额度</h3>
        <p className="text-[10px] text-gray-500 mb-3">{stockName} ({stockCode})</p>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">买入上限 (元)</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="不填则不限制"
            className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200"
          >
            取消
          </button>
          <button
            onClick={() => onSave(stockCode, Number(limit) || 0)}
            className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// 手动交易对话框
function TradeDialog({
  stockCode,
  stockName,
  currentPrice,
  direction,
  availableCapital,
  onExecute,
  onCancel,
}: {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  direction: "buy" | "sell";
  availableCapital: number;
  onExecute: (price: number, quantity: number) => void;
  onCancel: () => void;
}) {
  const [price, setPrice] = useState(currentPrice.toString());
  const [quantity, setQuantity] = useState("100");
  const amount = Number(price) * Number(quantity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#111827] border border-gray-700 rounded p-4 w-80">
        <h3 className="text-sm font-medium text-white mb-1">
          {direction === "buy" ? "买入" : "卖出"} {stockName}
        </h3>
        <p className="text-[10px] text-gray-500 mb-3">{stockCode}</p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">价格</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">数量 (股)</label>
            <input
              type="number"
              step="100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#0a0e17] border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="bg-[#0a0e17] rounded p-2">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">预计金额</span>
              <span className="text-gray-200 font-mono">¥{amount.toLocaleString()}</span>
            </div>
            {direction === "buy" && (
              <div className="flex justify-between text-[10px] mt-1">
                <span className="text-gray-500">可用资金</span>
                <span className="text-gray-200 font-mono">¥{availableCapital.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200"
          >
            取消
          </button>
          <button
            onClick={() => onExecute(Number(price), Number(quantity))}
            className={`px-3 py-1.5 text-xs rounded ${
              direction === "buy"
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
            }`}
          >
            确认{direction === "buy" ? "买入" : "卖出"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BacktestPanel() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState<"tracking" | "positions" | "trades" | "equity" | "settings">("tracking");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState<{ code: string; name: string; limit?: number } | null>(null);
  const [showTradeDialog, setShowTradeDialog] = useState<{
    code: string;
    name: string;
    price: number;
    direction: "buy" | "sell";
  } | null>(null);

  // 加载账户列表
  const refreshAccounts = useCallback(() => {
    const summaries = getAllAccountSummaries();
    setAccounts(summaries);
    const activeId = getActiveAccountId();
    if (activeId) {
      setActiveAccountIdState(activeId);
      const acc = loadAccount(activeId);
      if (acc) setAccount(acc);
    }
  }, []);

  // 初始化
  useEffect(() => {
    refreshAccounts();
    // 如果没有账户，创建演示账户
    const allAccounts = getAllAccountSummaries();
    if (allAccounts.length === 0) {
      const demo = generateDemoAccount();
      setActiveAccountId(demo.id);
      setAccount(demo);
      setActiveAccountIdState(demo.id);
      setAccounts(getAllAccountSummaries());
    }
  }, [refreshAccounts]);

  // 切换账户
  const switchAccount = (id: string) => {
    setActiveAccountId(id);
    setActiveAccountIdState(id);
    const acc = loadAccount(id);
    if (acc) setAccount(acc);
  };

  // 创建账户
  const handleCreateAccount = (name: string, capital: number) => {
    const acc = createAccount(name, capital);
    setActiveAccountId(acc.id);
    setActiveAccountIdState(acc.id);
    setAccount(acc);
    setAccounts(getAllAccountSummaries());
    setShowCreateDialog(false);
    addToast("success", `账户"${name}"创建成功`);
  };

  // 删除账户
  const handleDeleteAccount = (id: string, name: string) => {
    setShowConfirmDialog({
      title: "删除账户",
      message: `确定要删除账户"${name}"吗？所有交易记录和持仓数据将被永久删除。`,
      confirmText: name,
      onConfirm: () => {
        deleteAccount(id);
        const remaining = getAllAccountSummaries();
        setAccounts(remaining);
        if (remaining.length > 0) {
          switchAccount(remaining[0].id);
        } else {
          setAccount(null);
          setActiveAccountIdState(null);
        }
        setShowConfirmDialog(null);
        addToast("success", `账户"${name}"已删除`);
      },
    });
  };

  // Toast
  const addToast = (type: ToastMessage["type"], message: string) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message }]);
  };
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 跟踪/取消跟踪
  const toggleTracking = (code: string) => {
    if (!account) return;
    const updated = { ...account };
    if (updated.trackingList.includes(code)) {
      updated.trackingList = updated.trackingList.filter((c) => c !== code);
      addToast("info", "已取消跟踪");
    } else {
      updated.trackingList = [...updated.trackingList, code];
      addToast("success", "已加入跟踪列表");
    }
    saveAccount(updated);
    setAccount({ ...updated });
  };

  // 跟踪所有持仓
  const trackAllPositions = () => {
    if (!account) return;
    const updated = { ...account };
    const posCodes = updated.positions.map((p) => p.stockCode);
    const newList = new Set([...updated.trackingList, ...posCodes]);
    updated.trackingList = Array.from(newList);
    saveAccount(updated);
    setAccount({ ...updated });
    addToast("success", `已跟踪所有持仓股票 (${posCodes.length}只)`);
  };

  // 买入信号处理（自动操作逻辑）
  const handleBuySignal = (signal: BuySignal) => {
    if (!account) return;

    // 1. 检查跟踪列表
    if (!account.trackingList.includes(signal.stockCode)) {
      addToast("warning", `${signal.stockName}未在跟踪列表中，跳过自动操作`);
      return;
    }

    // 2. 检查买入额度
    const check = canBuyStock(account, signal.stockCode, signal.amount);
    if (!check.can) {
      addToast("error", check.reason);
      return;
    }

    // 3. 执行买入
    const updated = executeBuy(account, signal.stockCode, signal.stockName, signal.price, signal.amount, signal.reason, true);
    setAccount({ ...updated });
    setAccounts(getAllAccountSummaries());
    addToast("success", `自动买入 ${signal.stockName} ${signal.amount}元`);
  };

  // 手动交易
  const handleManualTrade = (price: number, quantity: number) => {
    if (!account || !showTradeDialog) return;
    const { code, name, direction } = showTradeDialog;

    if (direction === "buy") {
      const amount = price * quantity;
      const check = canBuyStock(account, code, amount);
      if (!check.can) {
        addToast("error", check.reason);
        setShowTradeDialog(null);
        return;
      }
      const updated = executeBuy(account, code, name, price, amount, "手动买入", false);
      setAccount({ ...updated });
      addToast("success", `买入 ${name} ${quantity}股`);
    } else {
      const updated = executeSell(account, code, price, quantity, "手动卖出", false);
      setAccount({ ...updated });
      addToast("success", `卖出 ${name} ${quantity}股`);
    }
    setAccounts(getAllAccountSummaries());
    setShowTradeDialog(null);
  };

  // 设置买入额度
  const handleSaveLimit = (code: string, limit: number) => {
    if (!account) return;
    const updated = { ...account };
    if (limit > 0) {
      updated.stockLimits[code] = limit;
    } else {
      delete updated.stockLimits[code];
    }
    saveAccount(updated);
    setAccount({ ...updated });
    setShowLimitDialog(null);
    addToast("success", limit > 0 ? `额度已设置为¥${limit.toLocaleString()}` : "额度限制已取消");
  };

  // 清理垃圾数据
  const handleCleanGarbage = () => {
    if (!account) return;
    const result = cleanGarbageData(account);
    const updated = loadAccount(account.id);
    if (updated) setAccount({ ...updated });
    setAccounts(getAllAccountSummaries());
    addToast("success", `清理完成，删除${result.deletedTrades}条交易记录`);
  };

  // 重置账户
  const handleResetAccount = () => {
    if (!account) return;
    setShowConfirmDialog({
      title: "重置账户",
      message: `确定要重置账户"${account.name}"吗？所有持仓和交易记录将被清空，但跟踪列表和额度设置会保留。`,
      confirmText: "重置",
      onConfirm: () => {
        const updated = resetAccount(account);
        setAccount({ ...updated });
        setAccounts(getAllAccountSummaries());
        setShowConfirmDialog(null);
        addToast("success", "账户已重置");
      },
    });
  };

  // 计算指标
  const metrics = account ? calculateMetrics(account) : null;
  const totalAssets = account ? getTotalAssets(account) : 0;
  const totalPnl = account ? totalAssets - account.initialCapital : 0;
  const totalPnlPercent = account && account.initialCapital > 0 ? (totalPnl / account.initialCapital) * 100 : 0;
  const marketValue = account ? account.positions.reduce((s, p) => s + p.marketValue, 0) : 0;
  const equityCurve = account ? generateEquityCurve(account) : [];

  const tabs = [
    { id: "tracking" as const, label: "跟踪", count: account?.trackingList.length || 0 },
    { id: "positions" as const, label: "持仓", count: account?.positions.length || 0 },
    { id: "trades" as const, label: "交易", count: account?.trades.length || 0 },
    { id: "equity" as const, label: "曲线" },
    { id: "settings" as const, label: "设置" },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0e17] text-gray-200">
      <Toast toasts={toasts} onRemove={removeToast} />
      {showCreateDialog && (
        <CreateAccountDialog
          onCreate={handleCreateAccount}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}
      {showConfirmDialog && (
        <ConfirmDialog
          title={showConfirmDialog.title}
          message={showConfirmDialog.message}
          confirmText={showConfirmDialog.confirmText}
          onConfirm={showConfirmDialog.onConfirm}
          onCancel={() => setShowConfirmDialog(null)}
        />
      )}
      {showLimitDialog && (
        <StockLimitDialog
          stockCode={showLimitDialog.code}
          stockName={showLimitDialog.name}
          currentLimit={showLimitDialog.limit}
          onSave={handleSaveLimit}
          onCancel={() => setShowLimitDialog(null)}
        />
      )}
      {showTradeDialog && account && (
        <TradeDialog
          stockCode={showTradeDialog.code}
          stockName={showTradeDialog.name}
          currentPrice={showTradeDialog.price}
          direction={showTradeDialog.direction}
          availableCapital={account.currentCapital}
          onExecute={handleManualTrade}
          onCancel={() => setShowTradeDialog(null)}
        />
      )}

      {/* 顶部：账户管理 */}
      <div className="p-2 border-b border-gray-800 bg-[#111827] flex-shrink-0">
        {/* 账户Tab */}
        <div className="flex items-center gap-1 mb-2 overflow-x-auto">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => switchAccount(acc.id)}
              className={`px-2 py-1 text-[10px] rounded whitespace-nowrap transition-colors ${
                acc.id === activeAccountId
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-gray-800/50 text-gray-500 hover:text-gray-300"
              }`}
            >
              {acc.name}
            </button>
          ))}
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-2 py-1 text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
          >
            + 新建
          </button>
        </div>

        {/* 账户概览 */}
        {account && (
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className="text-[10px] text-gray-500">总资产</div>
              <div className={`text-xs font-mono font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                ¥{totalAssets.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">可用</div>
              <div className="text-xs font-mono text-gray-300">
                ¥{account.currentCapital.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">盈亏</div>
              <div className={`text-xs font-mono font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {totalPnl >= 0 ? "+" : ""}{totalPnlPercent.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">仓位</div>
              <div className="text-xs font-mono text-yellow-400">
                {totalAssets > 0 ? ((marketValue / totalAssets) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab切换 */}
      <div className="flex border-b border-gray-800 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-1.5 text-[10px] transition-colors relative ${
              activeTab === tab.id
                ? "text-blue-400 border-b border-blue-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 text-[8px] bg-gray-700 text-gray-400 px-1 rounded">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {!account ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 mb-3">暂无账户</p>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
            >
              创建账户
            </button>
          </div>
        ) : (
          <>
            {/* 跟踪列表 */}
            {activeTab === "tracking" && (
              <div className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500">跟踪列表 ({account.trackingList.length})</span>
                  <div className="flex gap-1">
                    {account.positions.length > 0 && (
                      <button
                        onClick={trackAllPositions}
                        className="text-[10px] text-blue-400 hover:text-blue-300"
                      >
                        跟踪所有持仓
                      </button>
                    )}
                  </div>
                </div>

                {account.trackingList.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-600 mb-2">暂无跟踪股票</p>
                    <p className="text-[10px] text-gray-700">在分析面板中点击"跟踪此股票"添加</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {account.trackingList.map((code) => {
                      const pos = account.positions.find((p) => p.stockCode === code);
                      const limit = account.stockLimits[code];
                      return (
                        <div
                          key={code}
                          className="bg-[#111827] rounded p-2 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-200 truncate">
                                {pos?.stockName || code}
                              </span>
                              <span className="text-[10px] text-gray-600">{code}</span>
                              {limit && (
                                <span className="text-[8px] text-yellow-500/70 bg-yellow-500/10 px-1 rounded">
                                  限额¥{(limit / 10000).toFixed(0)}万
                                </span>
                              )}
                            </div>
                            {pos && (
                              <div className="flex items-center gap-3 mt-1 text-[10px]">
                                <span className="text-gray-500">
                                  持仓 {pos.quantity}股
                                </span>
                                <span className={pos.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                                  {pos.pnl >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(2)}%
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setShowTradeDialog({
                                code,
                                name: pos?.stockName || code,
                                price: pos?.currentPrice || 0,
                                direction: "buy",
                              })}
                              className="px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-400 rounded hover:bg-red-500/20"
                            >
                              买
                            </button>
                            {pos && (
                              <button
                                onClick={() => setShowTradeDialog({
                                  code,
                                  name: pos.stockName,
                                  price: pos.currentPrice,
                                  direction: "sell",
                                })}
                                className="px-1.5 py-0.5 text-[10px] bg-green-500/10 text-green-400 rounded hover:bg-green-500/20"
                              >
                                卖
                              </button>
                            )}
                            <button
                              onClick={() => toggleTracking(code)}
                              className="px-1.5 py-0.5 text-[10px] text-gray-600 hover:text-red-400"
                              title="取消跟踪"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 模拟买入信号演示 */}
                <div className="mt-3 border-t border-gray-800 pt-3">
                  <div className="text-[10px] text-gray-500 mb-2">模拟信号演示</div>
                  <div className="space-y-1">
                    <button
                      onClick={() => handleBuySignal({
                        stockCode: "688256",
                        stockName: "寒武纪",
                        price: 285.5,
                        amount: 28550,
                        reason: "缠论三买信号 + AI算力链热度",
                      })}
                      className="w-full text-left px-2 py-1.5 bg-[#111827] rounded text-[10px] hover:bg-[#1a2332] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-red-400">买入信号</span>
                        <span className="text-gray-400">寒武纪 688256</span>
                      </div>
                      <div className="text-gray-600 mt-0.5">¥285.50 × 100股 = ¥28,550 | 缠论三买</div>
                    </button>
                    <button
                      onClick={() => handleBuySignal({
                        stockCode: "002475",
                        stockName: "立讯精密",
                        price: 38.2,
                        amount: 38200,
                        reason: "波浪理论第3浪 + 消费电子回暖",
                      })}
                      className="w-full text-left px-2 py-1.5 bg-[#111827] rounded text-[10px] hover:bg-[#1a2332] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-red-400">买入信号</span>
                        <span className="text-gray-400">立讯精密 002475</span>
                      </div>
                      <div className="text-gray-600 mt-0.5">¥38.20 × 1000股 = ¥38,200 | 波浪第3浪</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 持仓 */}
            {activeTab === "positions" && (
              <div className="p-2">
                {account.positions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-600">暂无持仓</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {account.positions.map((pos) => {
                      const isTracking = account.trackingList.includes(pos.stockCode);
                      const limit = account.stockLimits[pos.stockCode];
                      const holdingValue = pos.marketValue;
                      const limitPercent = limit ? (holdingValue / limit) * 100 : 0;
                      return (
                        <div key={pos.stockCode} className="bg-[#111827] rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-200">{pos.stockName}</span>
                              <span className="text-[10px] text-gray-600">{pos.stockCode}</span>
                              {isTracking && (
                                <span className="text-[8px] text-blue-400 bg-blue-400/10 px-1 rounded">跟踪中</span>
                              )}
                            </div>
                            <span className={`text-xs font-mono font-bold ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {pos.pnl >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(2)}%
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-[10px] mb-1">
                            <div>
                              <span className="text-gray-600">持仓</span>
                              <div className="text-gray-300 font-mono">{pos.quantity}股</div>
                            </div>
                            <div>
                              <span className="text-gray-600">成本</span>
                              <div className="text-gray-300 font-mono">¥{pos.avgCost.toFixed(2)}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">现价</span>
                              <div className="text-gray-300 font-mono">¥{pos.currentPrice.toFixed(2)}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">盈亏</span>
                              <div className={`font-mono ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {pos.pnl >= 0 ? "+" : ""}¥{pos.pnl.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {/* 额度进度条 */}
                          {limit && (
                            <div className="mb-1">
                              <div className="flex justify-between text-[8px] text-gray-600 mb-0.5">
                                <span>额度使用</span>
                                <span>¥{holdingValue.toLocaleString()} / ¥{limit.toLocaleString()}</span>
                              </div>
                              <div className="h-1 bg-[#0a0e17] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    limitPercent > 80 ? "bg-red-500" : limitPercent > 50 ? "bg-yellow-500" : "bg-blue-500"
                                  }`}
                                  style={{ width: `${Math.min(100, limitPercent)}%` }}
                                />
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <div className="flex-1 bg-[#0a0e17] rounded-full h-1">
                              <div className="bg-blue-500/50 h-1 rounded-full" style={{ width: `${pos.positionPercent}%` }} />
                            </div>
                            <span className="text-[8px] text-gray-600">{pos.positionPercent}%</span>
                            <button
                              onClick={() => setShowTradeDialog({
                                code: pos.stockCode,
                                name: pos.stockName,
                                price: pos.currentPrice,
                                direction: "sell",
                              })}
                              className="px-1.5 py-0.5 text-[10px] bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 ml-1"
                            >
                              卖出
                            </button>
                            <button
                              onClick={() => toggleTracking(pos.stockCode)}
                              className={`px-1.5 py-0.5 text-[10px] rounded ${
                                isTracking
                                  ? "bg-blue-500/10 text-blue-400"
                                  : "bg-gray-800 text-gray-600 hover:text-blue-400"
                              }`}
                            >
                              {isTracking ? "已跟踪" : "跟踪"}
                            </button>
                            <button
                              onClick={() => setShowLimitDialog({
                                code: pos.stockCode,
                                name: pos.stockName,
                                limit,
                              })}
                              className="px-1.5 py-0.5 text-[10px] bg-gray-800 text-gray-500 rounded hover:text-yellow-400"
                              title="设置买入额度"
                            >
                              额度
                            </button>
                          </div>
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
                {account.trades.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-600">暂无交易记录</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[...account.trades].reverse().map((trade) => (
                      <div key={trade.id} className="bg-[#111827] rounded p-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] px-1 py-0.5 rounded ${
                              trade.direction === "buy"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-green-500/20 text-green-400"
                            }`}>
                              {trade.direction === "buy" ? "买" : "卖"}
                            </span>
                            <span className="text-xs text-gray-200">{trade.stockName}</span>
                            {trade.isAuto && (
                              <span className="text-[8px] text-purple-400 bg-purple-400/10 px-1 rounded">自动</span>
                            )}
                          </div>
                          {trade.pnl !== undefined && (
                            <span className={`text-[10px] font-mono ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {trade.pnl >= 0 ? "+" : ""}¥{trade.pnl.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-600">
                          <span>{new Date(trade.timestamp).toLocaleDateString()}</span>
                          <span>¥{trade.price.toFixed(2)} x {trade.quantity}股 = ¥{trade.amount.toLocaleString()}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{trade.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 资金曲线 */}
            {activeTab === "equity" && metrics && (
              <div className="p-2">
                {/* 策略指标 */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <div className="bg-[#111827] rounded p-2 text-center">
                    <div className="text-[8px] text-gray-600">累计收益</div>
                    <div className={`text-xs font-mono font-bold ${metrics.totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {metrics.totalReturn >= 0 ? "+" : ""}{metrics.totalReturn}%
                    </div>
                  </div>
                  <div className="bg-[#111827] rounded p-2 text-center">
                    <div className="text-[8px] text-gray-600">年化收益</div>
                    <div className={`text-xs font-mono font-bold ${metrics.annualReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {metrics.annualReturn}%
                    </div>
                  </div>
                  <div className="bg-[#111827] rounded p-2 text-center">
                    <div className="text-[8px] text-gray-600">最大回撤</div>
                    <div className="text-xs font-mono font-bold text-red-400">
                      {metrics.maxDrawdown}%
                    </div>
                  </div>
                  <div className="bg-[#111827] rounded p-2 text-center">
                    <div className="text-[8px] text-gray-600">夏普比率</div>
                    <div className="text-xs font-mono text-blue-400">{metrics.sharpeRatio}</div>
                  </div>
                  <div className="bg-[#111827] rounded p-2 text-center">
                    <div className="text-[8px] text-gray-600">胜率</div>
                    <div className={`text-xs font-mono ${metrics.winRate >= 50 ? "text-green-400" : "text-yellow-400"}`}>
                      {metrics.winRate}%
                    </div>
                  </div>
                  <div className="bg-[#111827] rounded p-2 text-center">
                    <div className="text-[8px] text-gray-600">盈亏比</div>
                    <div className="text-xs font-mono text-blue-400">{metrics.profitLossRatio}</div>
                  </div>
                </div>

                {/* 交易统计 */}
                <div className="bg-[#111827] rounded p-2 mb-3">
                  <div className="text-[10px] text-gray-500 mb-1">交易统计</div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-600">总交易</span>
                      <span className="text-gray-300 font-mono">{metrics.totalTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">盈利</span>
                      <span className="text-green-400 font-mono">{metrics.profitableTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">亏损</span>
                      <span className="text-red-400 font-mono">{metrics.losingTrades}</span>
                    </div>
                  </div>
                </div>

                {/* 资金曲线图 */}
                {equityCurve.length > 0 && (
                  <div className="bg-[#111827] rounded p-2">
                    <div className="text-[10px] text-gray-500 mb-1">资金走势（近30天）</div>
                    <div className="h-32 relative">
                      <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {(() => {
                          const values = equityCurve.map((p) => p.totalAssets);
                          const min = Math.min(...values) * 0.999;
                          const max = Math.max(...values) * 1.001;
                          const range = max - min || 1;
                          const toY = (v: number) => 100 - ((v - min) / range) * 100;
                          const points = equityCurve.map((p, i) => {
                            const x = (i / (equityCurve.length - 1)) * 300;
                            return `${x} ${toY(p.totalAssets)}`;
                          });
                          return (
                            <>
                              <path
                                d={`M 0 100 L ${points.join(" L ")} L 300 100 Z`}
                                fill="url(#eqGrad)"
                              />
                              <path
                                d={`M ${points.join(" L ")}`}
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth="1.5"
                              />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                    <div className="flex justify-between text-[8px] text-gray-600 mt-1">
                      <span>¥{equityCurve[0]?.totalAssets.toLocaleString()}</span>
                      <span>¥{equityCurve[equityCurve.length - 1]?.totalAssets.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 设置 */}
            {activeTab === "settings" && (
              <div className="p-2 space-y-3">
                {/* 账户信息 */}
                <div className="bg-[#111827] rounded p-2">
                  <div className="text-[10px] text-gray-500 mb-2">账户信息</div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-600">账户名称</span>
                      <span className="text-gray-300">{account.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">初始资金</span>
                      <span className="text-gray-300 font-mono">¥{account.initialCapital.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">创建时间</span>
                      <span className="text-gray-300">{new Date(account.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">跟踪股票</span>
                      <span className="text-blue-400">{account.trackingList.length}只</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">额度设置</span>
                      <span className="text-yellow-400">{Object.keys(account.stockLimits).length}只</span>
                    </div>
                  </div>
                </div>

                {/* 额度管理 */}
                <div className="bg-[#111827] rounded p-2">
                  <div className="text-[10px] text-gray-500 mb-2">买入额度管理</div>
                  {Object.keys(account.stockLimits).length === 0 ? (
                    <p className="text-[10px] text-gray-600">暂未设置额度限制</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(account.stockLimits).map(([code, limit]) => {
                        const pos = account.positions.find((p) => p.stockCode === code);
                        const used = pos?.marketValue || 0;
                        return (
                          <div key={code} className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-400">{pos?.stockName || code}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-mono">
                                ¥{used.toLocaleString()} / ¥{limit.toLocaleString()}
                              </span>
                              <button
                                onClick={() => setShowLimitDialog({
                                  code,
                                  name: pos?.stockName || code,
                                  limit,
                                })}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                编辑
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 数据管理 */}
                <div className="bg-[#111827] rounded p-2">
                  <div className="text-[10px] text-gray-500 mb-2">数据管理</div>
                  <div className="space-y-2">
                    <button
                      onClick={handleCleanGarbage}
                      className="w-full px-2 py-1.5 text-[10px] text-left bg-[#0a0e17] rounded hover:bg-[#1a2332] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-yellow-400">清理垃圾数据</span>
                        <span className="text-gray-600">删除已平仓30天+的记录</span>
                      </div>
                    </button>
                    <button
                      onClick={handleResetAccount}
                      className="w-full px-2 py-1.5 text-[10px] text-left bg-[#0a0e17] rounded hover:bg-[#1a2332] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-red-400">重置账户</span>
                        <span className="text-gray-600">清空持仓和交易记录</span>
                      </div>
                    </button>
                    {accounts.length > 1 && (
                      <button
                        onClick={() => handleDeleteAccount(account.id, account.name)}
                        className="w-full px-2 py-1.5 text-[10px] text-left bg-[#0a0e17] rounded hover:bg-red-500/5 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-red-500">删除此账户</span>
                          <span className="text-gray-600">永久删除所有数据</span>
                        </div>
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
