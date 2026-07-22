'use client';

import { useState } from 'react';
import { useQuantLiveMonitor } from './useQuantLiveMonitor';
import type { QuantLiveAccount } from './types';

export function QuantLivePanel() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', stockCode: '', stockName: '', initialCapital: 100000 });

  const {
    status,
    accounts,
    trades,
    positions,
    logs,
    lastCheckAt,
    createAccount,
    toggleAccountStatus,
    triggerCheck
  } = useQuantLiveMonitor(selectedAccountId);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const handleCreate = async () => {
    if (!newAccount.name || !newAccount.stockCode || !newAccount.initialCapital) return;
    const account = await createAccount(newAccount.name, newAccount.stockCode, newAccount.stockName, newAccount.initialCapital);
    if (account) {
      setSelectedAccountId(account.id);
      setShowCreateDialog(false);
      setNewAccount({ name: '', stockCode: '', stockName: '', initialCapital: 100000 });
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200">量化实时账户</h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          新建账户
        </button>
      </div>

      {/* 账户列表 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {accounts.map(account => (
          <button
            key={account.id}
            onClick={() => setSelectedAccountId(account.id)}
            className={`px-3 py-2 text-xs rounded whitespace-nowrap transition-colors ${
              selectedAccountId === account.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <div className="font-medium">{account.name}</div>
            <div className="text-[10px] opacity-75">
              {account.stock_code} · {account.status === 'active' ? '运行中' : '已暂停'}
            </div>
          </button>
        ))}
        {accounts.length === 0 && (
          <div className="text-xs text-slate-500 py-4">暂无账户，点击右上角创建</div>
        )}
      </div>

      {/* 选中账户详情 */}
      {selectedAccount && (
        <>
          {/* 账户信息 */}
          <div className="grid grid-cols-4 gap-3 p-3 bg-slate-800/50 rounded border border-slate-700/50">
            <div>
              <div className="text-[10px] text-slate-500">初始资金</div>
              <div className="text-sm font-mono text-slate-200">¥{selectedAccount.initial_capital.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">当前现金</div>
              <div className="text-sm font-mono text-slate-200">¥{selectedAccount.current_cash.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">状态</div>
              <div className={`text-sm font-medium ${selectedAccount.status === 'active' ? 'text-green-400' : 'text-slate-400'}`}>
                {selectedAccount.status === 'active' ? '运行中' : '已暂停'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">最后检查</div>
              <div className="text-sm font-mono text-slate-400">{lastCheckAt || '-'}</div>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex gap-2">
            <button
              onClick={() => toggleAccountStatus(selectedAccount.id, selectedAccount.status === 'active' ? 'paused' : 'active')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedAccount.status === 'active'
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {selectedAccount.status === 'active' ? '暂停监控' : '开启监控'}
            </button>
            <button
              onClick={triggerCheck}
              disabled={status !== 'connected'}
              className="px-3 py-1.5 text-xs font-medium bg-slate-700 text-slate-200 rounded hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              立即检查
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 ml-auto">
              <div className={`w-1.5 h-1.5 rounded-full ${
                status === 'connected' ? 'bg-green-400' :
                status === 'error' ? 'bg-red-400' : 'bg-slate-500'
              }`} />
              {status === 'connected' ? '已连接' : status === 'error' ? '连接失败' : '未连接'}
            </div>
          </div>

          {/* 持仓和交易记录 */}
          <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
            {/* 持仓 */}
            <div className="flex flex-col min-h-0">
              <h3 className="text-xs font-medium text-slate-400 mb-2">当前持仓</h3>
              <div className="flex-1 overflow-auto bg-slate-800/30 rounded border border-slate-700/50">
                {positions.length === 0 ? (
                  <div className="text-xs text-slate-500 p-4 text-center">无持仓</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-slate-500 sticky top-0 bg-slate-800/80">
                      <tr>
                        <th className="text-left p-2">股票</th>
                        <th className="text-right p-2">数量</th>
                        <th className="text-right p-2">成本</th>
                        <th className="text-right p-2">现价</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {positions.map(pos => (
                        <tr key={pos.id} className="border-t border-slate-700/30">
                          <td className="p-2">
                            <div className="font-medium">{pos.stock_code}</div>
                            <div className="text-[10px] text-slate-500">{pos.stock_name}</div>
                          </td>
                          <td className="text-right p-2 font-mono">{pos.quantity}</td>
                          <td className="text-right p-2 font-mono">{pos.cost_price.toFixed(2)}</td>
                          <td className="text-right p-2 font-mono">{pos.current_price?.toFixed(2) || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* 交易记录 */}
            <div className="flex flex-col min-h-0">
              <h3 className="text-xs font-medium text-slate-400 mb-2">交易记录</h3>
              <div className="flex-1 overflow-auto bg-slate-800/30 rounded border border-slate-700/50">
                {trades.length === 0 ? (
                  <div className="text-xs text-slate-500 p-4 text-center">暂无交易</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-slate-500 sticky top-0 bg-slate-800/80">
                      <tr>
                        <th className="text-left p-2">时间</th>
                        <th className="text-left p-2">操作</th>
                        <th className="text-right p-2">价格</th>
                        <th className="text-right p-2">数量</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {trades.slice(0, 50).map(trade => (
                        <tr key={trade.id} className="border-t border-slate-700/30">
                          <td className="p-2 text-[10px] text-slate-500">
                            {new Date(trade.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              trade.direction === 'buy' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                            }`}>
                              {trade.direction === 'buy' ? '买入' : '卖出'}
                            </span>
                          </td>
                          <td className="text-right p-2 font-mono">{trade.price.toFixed(2)}</td>
                          <td className="text-right p-2 font-mono">{trade.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* 实时日志 */}
          <div className="h-32 flex flex-col">
            <h3 className="text-xs font-medium text-slate-400 mb-2">实时日志</h3>
            <div className="flex-1 overflow-auto bg-slate-900/50 rounded border border-slate-700/50 p-2 font-mono text-[10px]">
              {logs.length === 0 ? (
                <div className="text-slate-500">等待日志...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`flex gap-2 ${
                    log.type === 'trade' ? 'text-blue-400' :
                    log.type === 'error' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    <span className="text-slate-600">{log.time}</span>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* 创建账户对话框 */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-96 border border-slate-700">
            <h3 className="text-lg font-bold text-slate-200 mb-4">新建量化账户</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">账户名称</label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="如：我的第一个量化账户"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">股票代码</label>
                <input
                  type="text"
                  value={newAccount.stockCode}
                  onChange={e => setNewAccount({ ...newAccount, stockCode: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="如：600519"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">股票名称（可选）</label>
                <input
                  type="text"
                  value={newAccount.stockName}
                  onChange={e => setNewAccount({ ...newAccount, stockName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="如：贵州茅台"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">初始资金</label>
                <input
                  type="number"
                  value={newAccount.initialCapital}
                  onChange={e => setNewAccount({ ...newAccount, initialCapital: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                创建
              </button>
              <button
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 px-4 py-2 text-sm font-medium bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
