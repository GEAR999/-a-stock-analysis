/**
 * 数据同步管理器
 * 负责前端数据变更时自动同步到后端
 */

interface SyncConfig {
  debounce: number;        // 防抖时间（毫秒）
  immediate: boolean;      // 是否立即同步
  retry: number;           // 重试次数
}

export const SYNC_CONFIG: Record<string, SyncConfig> = {
  accounts: { debounce: 1000, immediate: false, retry: 3 },
  transactions: { debounce: 500, immediate: true, retry: 3 },
  positions: { debounce: 500, immediate: true, retry: 3 },
  watchlist: { debounce: 1000, immediate: false, retry: 3 },
  strategies: { debounce: 2000, immediate: false, retry: 3 },
  backtest_sessions: { debounce: 3000, immediate: false, retry: 3 },
};

export class DataSyncManager {
  private syncQueue = new Map<string, NodeJS.Timeout>();
  private syncStatus = new Map<string, 'idle' | 'syncing' | 'error'>();

  // 同步数据
  async sync(table: string, data: any, config?: SyncConfig) {
    const syncConfig = config || SYNC_CONFIG[table];
    if (!syncConfig) {
      console.warn(`[Sync] No config for table: ${table}`);
      return;
    }

    // 清除旧的定时器
    if (this.syncQueue.has(table)) {
      clearTimeout(this.syncQueue.get(table));
    }

    // 设置新的定时器（防抖）
    const timeout = setTimeout(async () => {
      await this.executeSync(table, data, syncConfig.retry);
    }, syncConfig.debounce);

    this.syncQueue.set(table, timeout);
  }

  // 立即同步（不防抖）
  async syncImmediate(table: string, data: any, retry = 3) {
    await this.executeSync(table, data, retry);
  }

  // 执行同步
  private async executeSync(table: string, data: any, retry: number) {
    this.syncStatus.set(table, 'syncing');

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, data, action: 'upsert' }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      this.syncStatus.set(table, 'idle');
      console.log(`[Sync] ${table} synced successfully`);

    } catch (error) {
      console.error(`[Sync] ${table} sync failed:`, error);

      if (retry > 0) {
        // 5 秒后重试
        setTimeout(() => this.executeSync(table, data, retry - 1), 5000);
      } else {
        this.syncStatus.set(table, 'error');
        this.showSyncError(table);
      }
    }
  }

  // 显示同步错误
  private showSyncError(table: string) {
    if (typeof window === 'undefined') return;

    // 可以在这里添加 UI 提示
    console.warn(`[Sync] ${table} sync failed after retries`);
  }

  // 获取同步状态
  getSyncStatus(table: string): 'idle' | 'syncing' | 'error' {
    return this.syncStatus.get(table) || 'idle';
  }

  // 取消所有同步
  cancelAll() {
    this.syncQueue.forEach((timeout) => clearTimeout(timeout));
    this.syncQueue.clear();
  }
}

// 单例
export const syncManager = new DataSyncManager();
