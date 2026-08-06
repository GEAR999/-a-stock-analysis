'use client';

import { useState } from 'react';

export default function CacheClearButton() {
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleClear = async () => {
    setClearing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/cache/kline?code=all', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: '✅ 缓存已清空，刷新页面即可获取最新数据' });
        // 延迟刷新，让用户看到消息
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage({ type: 'error', text: `❌ 清空失败: ${data.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '❌ 请求失败，请重试' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClear}
        disabled={clearing}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded
          bg-[var(--bg-card)] border border-[var(--border-default)]
          text-[var(--text-secondary)] hover:text-[var(--text-primary)]
          hover:border-orange-500/30 transition-colors disabled:opacity-50"
        title="清空 K 线数据缓存，强制从 Tushare 拉取最新数据"
      >
        <svg className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {clearing ? '清空中...' : '清缓存'}
      </button>

      {message && (
        <div className={`absolute top-full right-0 mt-2 z-50 whitespace-nowrap px-3 py-2 rounded text-xs shadow-lg border
          ${message.type === 'success'
            ? 'bg-emerald-900/90 border-emerald-700 text-emerald-200'
            : 'bg-rose-900/90 border-rose-700 text-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}