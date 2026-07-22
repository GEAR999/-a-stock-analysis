'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppState } from '@/hooks/useAppState';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatContext {
  stock?: {
    code: string;
    name: string;
    price?: number;
    change?: number;
  };
  signals?: string[];
  indicators?: {
    macd?: { dif?: number; dea?: number; histogram?: number };
    kdj?: { k?: number; d?: number; j?: number };
    rsi?: number;
  };
  chanlun?: string;
  wave?: string;
  position?: {
    stockCount: number;
    totalValue: number;
    totalProfit: number;
    totalProfitPercent: number;
  };
  market?: {
    shanghai?: string;
    shenzhen?: string;
    chinext?: string;
  };
  backtest?: string;
}

const STORAGE_KEY = 'ai-chat-history';
const MAX_MESSAGES = 50;

// 快捷指令
const QUICK_COMMANDS = [
  { id: 'analyze', label: '📊 分析当前股票', icon: '📊' },
  { id: 'position', label: '💼 诊断持仓', icon: '💼' },
  { id: 'market', label: '📈 今日市场', icon: '📈' },
  { id: 'backtest', label: '🔄 复盘回测', icon: '🔄' },
];

export default function AIChatWidget() {
  const { selectedStock, currentQuote, watchlist } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 加载历史消息
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-MAX_MESSAGES));
        }
      }
    } catch {
      // 忽略解析错误
    }
  }, []);

  // 保存消息到 localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
      } catch {
        // 忽略存储错误
      }
    }
  }, [messages]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 构建上下文数据
  const buildContext = useCallback((): ChatContext => {
    const context: ChatContext = {};

    // 当前股票
    if (selectedStock) {
      context.stock = {
        code: selectedStock.code,
        name: selectedStock.name,
        price: currentQuote?.price,
        change: currentQuote?.changePercent,
      };
    }

    return context;
  }, [selectedStock, currentQuote]);

  // 发送消息
  const sendMessage = async (content: string, context?: ChatContext) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: content.trim() }],
          context: context || buildContext(),
        }),
      });

      if (!response.ok) {
        let errorMsg = 'AI服务请求失败';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch {
          // 响应体可能已被读取或非 JSON 格式
        }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.content) {
              accumulated += data.content;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessage.id
                    ? { ...m, content: accumulated }
                    : m
                )
              );
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 标记流式结束
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? { ...m, isStreaming: false }
            : m
        )
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? { ...m, content: `❌ 请求失败: ${errorMessage}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 处理快捷指令
  const handleQuickCommand = (commandId: string) => {
    let content = '';
    let context: ChatContext = buildContext();

    switch (commandId) {
      case 'analyze':
        if (!selectedStock) {
          content = '请先选择一只股票进行分析';
          sendMessage(content);
          return;
        }
        content = `请分析 ${selectedStock.name}(${selectedStock.code}) 的当前走势和操作建议`;
        break;
      case 'position':
        content = '请诊断我当前的持仓情况，给出优化建议';
        break;
      case 'market':
        content = '请分析今日市场整体情况';
        break;
      case 'backtest':
        content = '请帮我复盘最近一次回测结果，分析策略表现';
        break;
      default:
        return;
    }

    sendMessage(content, context);
  };

  // 新建对话
  const handleNewChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* 悬浮按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[var(--accent-blue)] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-50"
          title="智析助手"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {/* 聊天面板 */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[400px] h-[500px] bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--accent-blue)] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">智析助手</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNewChat}
                className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title="新建对话"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title="关闭"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-card)] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-4">你好，我是智析助手</p>
                <p className="text-xs text-[var(--text-muted)] mb-4">可以问我任何关于A股的问题</p>
                
                {/* 快捷指令 */}
                <div className="grid grid-cols-2 gap-2 px-4">
                  {QUICK_COMMANDS.map(cmd => (
                    <button
                      key={cmd.id}
                      onClick={() => handleQuickCommand(cmd.id)}
                      className="px-3 py-2 text-xs rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition-colors"
                    >
                      {cmd.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-[var(--accent-blue)] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)]'
                  }`}
                >
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-[var(--text-secondary)] animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* 快捷指令栏（有消息时显示） */}
          {messages.length > 0 && (
            <div className="px-3 py-2 border-t border-[var(--border-default)] flex gap-1.5 overflow-x-auto">
              {QUICK_COMMANDS.map(cmd => (
                <button
                  key={cmd.id}
                  onClick={() => handleQuickCommand(cmd.id)}
                  disabled={isLoading}
                  className="px-2 py-1 text-xs rounded bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {cmd.icon}
                </button>
              ))}
            </div>
          )}

          {/* 输入区域 */}
          <div className="p-3 border-t border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入问题，Enter发送..."
                className="flex-1 resize-none bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-lg bg-[var(--accent-blue)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
