/**
 * storage 单元测试
 * 测试回测账户存储和管理功能
 */

import {
  generateId,
  saveAccount,
  loadAccount,
  deleteAccount,
  getAllAccounts,
  getAllAccountSummaries,
  getActiveAccountId,
  setActiveAccountId,
  createAccount,
  calculateMetrics,
  getTotalAssets,
  generateEquityCurve,
} from '../storage';
import type { Account, Trade, Position } from '../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock cloud sync
jest.mock('@/lib/api-client-db', () => ({
  syncAccountToCloud: jest.fn(() => Promise.resolve()),
}));

describe('storage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct format', () => {
      const id = generateId();
      expect(id).toMatch(/^acc_\d+_[a-z0-9]{6}$/);
    });
  });

  describe('saveAccount and loadAccount', () => {
    it('should save and load account correctly', () => {
      const account: Account = {
        id: 'test-1',
        name: '测试账户',
        type: 'manual',
        initialCapital: 1000000,
        currentCapital: 1000000,
        positions: [],
        trades: [],
        trackingList: [],
        stockLimits: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      saveAccount(account);
      const loaded = loadAccount('test-1');

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('测试账户');
      expect(loaded?.initialCapital).toBe(1000000);
    });

    it('should return null for non-existent account', () => {
      const loaded = loadAccount('non-existent');
      expect(loaded).toBeNull();
    });
  });

  describe('deleteAccount', () => {
    it('should delete account from storage', () => {
      const account: Account = {
        id: 'test-delete',
        name: '测试删除',
        type: 'manual',
        initialCapital: 1000000,
        currentCapital: 1000000,
        positions: [],
        trades: [],
        trackingList: [],
        stockLimits: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      saveAccount(account);
      expect(loadAccount('test-delete')).toBeDefined();

      deleteAccount('test-delete');
      expect(loadAccount('test-delete')).toBeNull();
    });

    it('should clear active account if deleted', () => {
      setActiveAccountId('test-active');
      deleteAccount('test-active');
      expect(getActiveAccountId()).toBeNull();
    });
  });

  describe('getAllAccounts', () => {
    it('should return all accounts sorted by updatedAt', () => {
      const account1: Account = {
        id: 'acc-1',
        name: '账户1',
        type: 'manual',
        initialCapital: 1000000,
        currentCapital: 1000000,
        positions: [],
        trades: [],
        trackingList: [],
        stockLimits: {},
        createdAt: Date.now() - 2000,
        updatedAt: Date.now() - 2000,
      };

      saveAccount(account1);
      
      // Wait a bit to ensure different timestamps
      const account2: Account = {
        id: 'acc-2',
        name: '账户2',
        type: 'manual',
        initialCapital: 2000000,
        currentCapital: 2000000,
        positions: [],
        trades: [],
        trackingList: [],
        stockLimits: {},
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
      };

      saveAccount(account2);

      const accounts = getAllAccounts();
      expect(accounts).toHaveLength(2);
      // Most recently updated should be first
      expect(accounts[0].updatedAt).toBeGreaterThanOrEqual(accounts[1].updatedAt);
    });

    it('should return empty array when no accounts', () => {
      const accounts = getAllAccounts();
      expect(accounts).toEqual([]);
    });
  });

  describe('createAccount', () => {
    it('should create manual account correctly', () => {
      const account = createAccount('手动账户', 1000000, 'manual');
      
      expect(account.id).toBeDefined();
      expect(account.name).toBe('手动账户');
      expect(account.type).toBe('manual');
      expect(account.initialCapital).toBe(1000000);
      expect(account.currentCapital).toBe(1000000);
      expect(account.positions).toEqual([]);
      expect(account.trades).toEqual([]);
    });

    it('should create quant account with default strategy', () => {
      const account = createAccount('量化账户', 1000000, 'quant');
      
      expect(account.type).toBe('quant');
      expect(account.strategy).toBeDefined();
      expect(account.strategy?.name).toBe('默认量化策略');
    });
  });

  describe('getTotalAssets', () => {
    it('should calculate total assets correctly', () => {
      const account: Account = {
        id: 'test',
        name: '测试',
        type: 'manual',
        initialCapital: 1000000,
        currentCapital: 800000,
        positions: [
          {
            stockCode: '000858',
            stockName: '五粮液',
            quantity: 100,
            avgCost: 130,
            currentPrice: 135,
            marketValue: 13500,
            pnl: 500,
            pnlPercent: 3.85,
            positionPercent: 0,
          },
        ],
        trades: [],
        trackingList: [],
        stockLimits: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const total = getTotalAssets(account);
      expect(total).toBe(813500); // 800000 + 13500
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics for account with trades', () => {
      const account: Account = {
        id: 'test',
        name: '测试',
        type: 'manual',
        initialCapital: 1000000,
        currentCapital: 1050000,
        positions: [],
        trades: [
          {
            id: 't1',
            stockCode: '000858',
            stockName: '五粮液',
            direction: 'buy',
            price: 130,
            quantity: 100,
            amount: 13000,
            reason: 'manual',
            timestamp: Date.now() - 86400000,
          },
          {
            id: 't2',
            stockCode: '000858',
            stockName: '五粮液',
            direction: 'sell',
            price: 135,
            quantity: 100,
            amount: 13500,
            pnl: 500,
            reason: 'manual',
            timestamp: Date.now(),
          },
        ],
        trackingList: [],
        stockLimits: {},
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      };

      const metrics = calculateMetrics(account);
      
      expect(metrics.totalTrades).toBe(2);
      expect(metrics.profitableTrades).toBe(1);
      expect(metrics.losingTrades).toBe(0);
      expect(metrics.winRate).toBe(100);
    });

    it('should return zero metrics for empty account', () => {
      const account: Account = {
        id: 'test',
        name: '测试',
        type: 'manual',
        initialCapital: 1000000,
        currentCapital: 1000000,
        positions: [],
        trades: [],
        trackingList: [],
        stockLimits: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const metrics = calculateMetrics(account);
      
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.totalReturn).toBe(0);
    });
  });

  describe('generateEquityCurve', () => {
    it('should return empty array for account with no trades', () => {
      const account: Account = {
        id: 'test',
        name: '测试',
        type: 'manual',
        initialCapital: 1000000,
        currentCapital: 1000000,
        positions: [],
        trades: [],
        trackingList: [],
        stockLimits: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const curve = generateEquityCurve(account);
      expect(curve).toEqual([]);
    });

    it('should generate equity curve from trades', () => {
      const account: Account = {
        id: 'test',
        name: '测试',
        type: 'manual',
        initialCapital: 1000000,
        currentCapital: 1005000,
        positions: [],
        trades: [
          {
            id: 't1',
            stockCode: '000858',
            stockName: '五粮液',
            direction: 'buy',
            price: 130,
            quantity: 100,
            amount: 13000,
            reason: 'manual',
            timestamp: Date.now() - 86400000 * 2,
          },
          {
            id: 't2',
            stockCode: '000858',
            stockName: '五粮液',
            direction: 'sell',
            price: 135,
            quantity: 100,
            amount: 13500,
            pnl: 500,
            reason: 'manual',
            timestamp: Date.now() - 86400000,
          },
        ],
        trackingList: [],
        stockLimits: {},
        createdAt: Date.now() - 86400000 * 3,
        updatedAt: Date.now(),
      };

      const curve = generateEquityCurve(account);
      expect(curve.length).toBeGreaterThan(0);
      expect(curve[0].totalAssets).toBeDefined();
      expect(curve[0].cash).toBeDefined();
      expect(curve[0].marketValue).toBeDefined();
    });
  });
});
