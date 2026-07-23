'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { QuantLiveAccount, QuantLiveTrade, QuantLivePosition, WSMessage, MonitorStatus } from './types';

const WS_URL = 'ws://47.122.115.203:8889';
const API_BASE = '/api/quant-live'; // 通过 Next.js 代理

export function useQuantLiveMonitor(accountId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<MonitorStatus>('idle');
  const [accounts, setAccounts] = useState<QuantLiveAccount[]>([]);
  const [trades, setTrades] = useState<QuantLiveTrade[]>([]);
  const [positions, setPositions] = useState<QuantLivePosition[]>([]);
  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'trade' | 'error' }>>([]);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);

  const addLog = useCallback((message: string, type: 'info' | 'trade' | 'error' = 'info') => {
    setLogs(prev => [{
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      message,
      type
    }, ...prev].slice(0, 100));
  }, []);

  // 加载账户列表
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}?path=/api/accounts`);
      const json = await res.json();
      setAccounts(json.data || []);
    } catch (err) {
      addLog('加载账户失败', 'error');
    }
  }, [addLog]);

  // 加载交易记录
  const loadTrades = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetch(`${API_BASE}?path=/api/accounts/${accountId}/trades`);
      const json = await res.json();
      setTrades(json.data || []);
    } catch (err) {
      addLog('加载交易记录失败', 'error');
    }
  }, [accountId, addLog]);

  // 加载持仓
  const loadPositions = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetch(`${API_BASE}?path=/api/accounts/${accountId}/positions`);
      const json = await res.json();
      setPositions(json.data || []);
    } catch (err) {
      addLog('加载持仓失败', 'error');
    }
  }, [accountId, addLog]);

  // 创建账户
  const createAccount = useCallback(async (
    name: string, 
    stockCode: string, 
    stockName: string, 
    initialCapital: number,
    strategyId?: string,
    strategyConfig?: any
  ) => {
    try {
      console.log('[QuantLive] Creating account:', { name, stockCode, stockName, initialCapital, strategyId });
      const res = await fetch(`${API_BASE}?path=/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          stock_code: stockCode, 
          stock_name: stockName, 
          initial_capital: initialCapital,
          strategy_id: strategyId,
          strategy_config: strategyConfig
        })
      });
      console.log('[QuantLive] Response status:', res.status);
      const json = await res.json();
      console.log('[QuantLive] Response data:', json);
      
      // 后端返回 {data: [account]} 或 {data: account}
      const account = Array.isArray(json.data) ? json.data[0] : json.data;
      
      if (!account) {
        console.error('[QuantLive] No data in response:', json);
        addLog(`创建失败：${json.error || '未知错误'}`, 'error');
        return null;
      }
      await loadAccounts();
      addLog(`创建账户：${name}`, 'info');
      return account;
    } catch (err) {
      console.error('[QuantLive] Create account error:', err);
      addLog(`创建账户失败：${err.message}`, 'error');
      return null;
    }
  }, [loadAccounts, addLog]);

  // 切换账户状态
  const toggleAccountStatus = useCallback(async (id: string, newStatus: 'active' | 'paused') => {
    try {
      await fetch(`${API_BASE}?path=/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      await loadAccounts();
      addLog(`账户状态：${newStatus === 'active' ? '已激活' : '已暂停'}`, 'info');
    } catch (err) {
      addLog('切换状态失败', 'error');
    }
  }, [loadAccounts, addLog]);

  // 手动触发检查
  const triggerCheck = useCallback(async () => {
    if (!accountId) return;
    addLog('手动触发检查...', 'info');
    try {
      const res = await fetch(`${API_BASE}?path=/api/accounts/${accountId}/run`, { method: 'POST' });
      const data = await res.json();
      if (data.trades && data.trades.length > 0) {
        addLog(`执行 ${data.trades.length} 笔交易`, 'trade');
        await loadTrades();
        await loadPositions();
      } else {
        addLog('无交易信号', 'info');
      }
      setLastCheckAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch (err) {
      addLog('触发检查失败', 'error');
    }
  }, [accountId, addLog, loadTrades, loadPositions]);

  // 删除账户
  const deleteAccount = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}?path=/api/accounts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        if (accountId === id) {
          // 如果删除的是当前选中的账户，清空选中状态
          window.dispatchEvent(new CustomEvent('quant-live-clear-selection'));
        }
        await loadAccounts();
        addLog('账户已删除', 'info');
        return true;
      } else {
        addLog(`删除失败：${json.error || '未知错误'}`, 'error');
        return false;
      }
    } catch (err) {
      addLog('删除账户失败', 'error');
      return false;
    }
  }, [accountId, loadAccounts, addLog]);

  // WebSocket 连接（暂时禁用，HTTPS 页面无法连接 ws://）
  // TODO: 部署后改用 wss:// 或通过代理
  useEffect(() => {
    if (!accountId) return;
    // const ws = new WebSocket(WS_URL);
    // ... WebSocket 逻辑暂时注释
    addLog('WebSocket 暂不可用（HTTPS 限制）', 'info');
    return () => {};
  }, [accountId, addLog]);

  // 初始加载
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accountId) {
      loadTrades();
      loadPositions();
    }
  }, [accountId, loadTrades, loadPositions]);

  return {
    status,
    accounts,
    trades,
    positions,
    logs,
    lastCheckAt,
    createAccount,
    toggleAccountStatus,
    triggerCheck,
    deleteAccount,
    loadAccounts
  };
}
