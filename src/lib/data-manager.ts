/**
 * 数据管理器
 * 统一管理前端数据操作和后端同步
 */

import { syncManager } from './sync-manager';

export class DataManager {
  // 保存回测会话
  async saveBacktestSession(session: any) {
    try {
      // 1. 保存到后端（主存储）
      const response = await fetch('/api/backtest/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });

      if (!response.ok) {
        throw new Error('Save failed');
      }

      const result = await response.json();

      // 2. 同时保存到 IndexedDB（离线可用）
      if (typeof window !== 'undefined') {
        const db = await this.openDB();
        const tx = db.transaction('backtest_sessions', 'readwrite');
        const store = tx.objectStore('backtest_sessions');
        await store.put({ ...session, id: result.data.id, synced: true });
      }

      return { success: true, id: result.data.id };
    } catch (error) {
      console.error('[DataManager] saveBacktestSession error:', error);
      
      // 保存失败，尝试只存 IndexedDB
      if (typeof window !== 'undefined') {
        const db = await this.openDB();
        const tx = db.transaction('backtest_sessions', 'readwrite');
        const store = tx.objectStore('backtest_sessions');
        await store.put({ ...session, synced: false });
      }

      return { success: false, error: '保存失败，已保存到本地' };
    }
  }

  // 加载回测会话列表
  async loadBacktestSessions(status = 'saved') {
    try {
      const response = await fetch(`/api/backtest/sessions?status=${status}`);
      
      if (!response.ok) {
        throw new Error('Load failed');
      }

      const result = await response.json();

      // 更新 IndexedDB
      if (typeof window !== 'undefined' && result.data) {
        const db = await this.openDB();
        const tx = db.transaction('backtest_sessions', 'readwrite');
        const store = tx.objectStore('backtest_sessions');
        
        // 清空旧数据
        await store.clear();
        
        // 写入新数据
        for (const session of result.data) {
          await store.put({ ...session, synced: true });
        }
      }

      return { success: true, data: result.data };
    } catch (error) {
      console.error('[DataManager] loadBacktestSessions error:', error);

      // 从 IndexedDB 加载（离线模式）
      if (typeof window !== 'undefined') {
        const db = await this.openDB();
        const tx = db.transaction('backtest_sessions', 'readonly');
        const store = tx.objectStore('backtest_sessions');
        const sessions = await store.getAll();
        
        return { success: true, data: sessions, offline: true };
      }

      return { success: false, error: '加载失败' };
    }
  }

  // 删除回测会话
  async deleteBacktestSession(id: string) {
    try {
      const response = await fetch(`/api/backtest/sessions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      // 从 IndexedDB 删除
      if (typeof window !== 'undefined') {
        const db = await this.openDB();
        const tx = db.transaction('backtest_sessions', 'readwrite');
        const store = tx.objectStore('backtest_sessions');
        await store.delete(id);
      }

      return { success: true };
    } catch (error) {
      console.error('[DataManager] deleteBacktestSession error:', error);
      return { success: false, error: '删除失败' };
    }
  }

  // 打开 IndexedDB
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('stock-analysis', 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建回测会话表
        if (!db.objectStoreNames.contains('backtest_sessions')) {
          db.createObjectStore('backtest_sessions', { keyPath: 'id' });
        }
      };
    });
  }
}

// 单例
export const dataManager = new DataManager();
