import { useState, useCallback, useEffect } from 'react';
import {
  createAccount,
  loadAccount,
  saveAccount,
  deleteAccount,
  getAllAccountSummaries,
  getActiveAccountId,
  setActiveAccountId,
  generateDemoAccount,
  executeBuy,
  executeSell,
  canBuyStock,
} from '../storage';
import type { Account, AccountSummary, AccountType, StrategyWeight, QuantStrategy, RunMode } from '../types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export function useAccountManager() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    setToasts((prev) => [...prev, { id: generateId(), type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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

  useEffect(() => {
    refreshAccounts();
    const allAccounts = getAllAccountSummaries();
    if (allAccounts.length === 0) {
      const demo = generateDemoAccount();
      setActiveAccountId(demo.id);
      setAccount(demo);
      setActiveAccountIdState(demo.id);
      setAccounts(getAllAccountSummaries());
    }
  }, [refreshAccounts]);

  const switchAccount = useCallback((id: string) => {
    setActiveAccountId(id);
    setActiveAccountIdState(id);
    const acc = loadAccount(id);
    if (acc) setAccount(acc);
  }, []);

  const handleCreateAccount = useCallback((name: string, capital: number, accountType: AccountType, strategy?: QuantStrategy, runMode?: RunMode) => {
    const acc = createAccount(name, capital, accountType, strategy, runMode);
    setActiveAccountId(acc.id);
    setActiveAccountIdState(acc.id);
    setAccount(acc);
    setAccounts(getAllAccountSummaries());
    const modeText = accountType === 'quant' ? (runMode === 'realtime' ? '（实时验证）' : '（历史回测）') : '';
    addToast('success', `账户"${name}"创建成功${modeText}`);
    return acc;
  }, [addToast]);

  const handleDeleteAccount = useCallback((id: string, name: string) => {
    deleteAccount(id);
    const remaining = getAllAccountSummaries();
    setAccounts(remaining);
    if (remaining.length > 0) {
      switchAccount(remaining[0].id);
    } else {
      setAccount(null);
      setActiveAccountIdState(null);
    }
    addToast('success', `账户"${name}"已删除`);
  }, [switchAccount, addToast]);

  const updateAccount = useCallback((updated: Account) => {
    saveAccount(updated);
    setAccount({ ...updated });
    setAccounts(getAllAccountSummaries());
  }, []);

  return {
    accounts,
    activeAccountId,
    account,
    toasts,
    addToast,
    removeToast,
    refreshAccounts,
    switchAccount,
    handleCreateAccount,
    handleDeleteAccount,
    updateAccount,
    setAccount,
    setAccounts,
  };
}
