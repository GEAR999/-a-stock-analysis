'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';

interface AIEmbedContextType {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const AIEmbedContext = createContext<AIEmbedContextType>({
  enabled: true,
  setEnabled: () => {},
});

export function AIEmbedProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    // 从localStorage读取初始状态
    const stored = localStorage.getItem('ai_embed_enabled');
    if (stored !== null) {
      setEnabledState(stored !== 'false');
    }
  }, []);

  const setEnabled = (value: boolean) => {
    setEnabledState(value);
    localStorage.setItem('ai_embed_enabled', String(value));
  };

  return (
    <AIEmbedContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </AIEmbedContext.Provider>
  );
}

export function useAIEmbed() {
  return useContext(AIEmbedContext);
}

/**
 * AI嵌入开关组件
 * 放在页面顶部工具栏或设置区域
 */
export function AIEmbedToggle() {
  const { enabled, setEnabled } = useAIEmbed();

  return (
    <button
      onClick={() => setEnabled(!enabled)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
        enabled
          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
      }`}
      title={enabled ? '点击关闭AI增强分析' : '点击开启AI增强分析'}
    >
      <span className="text-sm">{enabled ? '🤖' : '🤖'}</span>
      <span>AI增强</span>
      <span className={`w-6 h-3 rounded-full relative transition-colors ${
        enabled ? 'bg-blue-500' : 'bg-[var(--bg-hover)]'
      }`}>
        <span className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${
          enabled ? 'left-3.5' : 'left-0.5'
        }`} />
      </span>
    </button>
  );
}

/**
 * AI嵌入区域包装器
 * 根据开关状态显示/隐藏内容
 */
export function AIEmbedSection({ 
  children, 
  title,
  className = '' 
}: { 
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  const { enabled } = useAIEmbed();

  if (!enabled) return null;

  return (
    <div className={`mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-card)]">
          <span className="text-blue-400">🤖</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{title}</span>
        </div>
      )}
      <div className="p-3">
        {children}
      </div>
    </div>
  );
}
