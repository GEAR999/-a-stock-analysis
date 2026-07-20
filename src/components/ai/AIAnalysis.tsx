'use client';

import { useState, useEffect, useCallback } from 'react';
import { callEmbeddedAI, formatContextForAI, type AIEmbedResponse } from '@/lib/ai-embed';
import { AIEmbedSection, useAIEmbed } from './AIEmbedToggle';

interface AIAnalysisProps {
  /** 分析类型标识 */
  type: 'review' | 'optimization' | 'summary' | 'risk';
  /** 给AI的指令 */
  prompt: string;
  /** 上下文数据 */
  context: Record<string, any>;
  /** 标题 */
  title: string;
  /** 是否显示（由父组件控制，例如需要有数据时才显示） */
  visible?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 通用AI分析组件
 * 用于在各模块中嵌入AI分析功能
 */
export function AIAnalysis({
  type,
  prompt,
  context,
  title,
  visible = true,
  className = '',
}: AIAnalysisProps) {
  const { enabled } = useAIEmbed();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIEmbedResponse | null>(null);
  const [contextHash, setContextHash] = useState('');

  // 生成上下文数据的hash，用于检测数据变化
  const generateHash = useCallback((data: Record<string, any>) => {
    try {
      return JSON.stringify(data).slice(0, 200);
    } catch {
      return '';
    }
  }, []);

  // 当context变化时重新分析
  useEffect(() => {
    if (!enabled || !visible) return;

    const newHash = generateHash(context);
    if (newHash === contextHash && result?.success) return;

    setContextHash(newHash);
    
    const analyze = async () => {
      setLoading(true);
      setResult(null);
      
      const response = await callEmbeddedAI({ prompt, context });
      
      setResult(response);
      setLoading(false);
    };

    // 延迟300ms执行，避免频繁请求
    const timer = setTimeout(analyze, 300);
    return () => clearTimeout(timer);
  }, [enabled, visible, prompt, context, generateHash]);

  if (!enabled || !visible) return null;

  return (
    <AIEmbedSection title={title} className={className}>
      {loading ? (
        <LoadingSkeleton type={type} />
      ) : result?.success ? (
        <AnalysisContent type={type} content={result.content!} />
      ) : result?.error ? (
        <ErrorMessage message={result.error} />
      ) : (
        <EmptyState />
      )}
    </AIEmbedSection>
  );
}

/**
 * 加载骨架屏
 */
function LoadingSkeleton({ type }: { type: string }) {
  return (
    <div className="animate-pulse space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-[var(--bg-card)]" />
        <div className="h-4 w-24 rounded bg-[var(--bg-card)]" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-[var(--bg-card)]" />
        <div className="h-3 w-4/5 rounded bg-[var(--bg-card)]" />
        <div className="h-3 w-3/5 rounded bg-[var(--bg-card)]" />
      </div>
      {type === 'optimization' && (
        <div className="pt-2 space-y-1">
          <div className="h-3 w-2/3 rounded bg-[var(--bg-card)]" />
          <div className="h-3 w-1/2 rounded bg-[var(--bg-card)]" />
        </div>
      )}
    </div>
  );
}

/**
 * 分析内容展示
 */
function AnalysisContent({ type, content }: { type: string; content: string }) {
  // 根据类型使用不同的样式
  const typeStyles = {
    review: 'border-l-2 border-l-blue-400 pl-3',
    optimization: 'border-l-2 border-l-green-400 pl-3',
    summary: 'border-l-2 border-l-purple-400 pl-3',
    risk: 'border-l-2 border-l-yellow-400 pl-3',
  };

  // 解析内容，处理可能的markdown格式
  const lines = content.split('\n').filter(line => line.trim());
  
  return (
    <div className={`${typeStyles[type as keyof typeof typeStyles] || ''}`}>
      {lines.map((line, idx) => {
        // 检测优先级标签
        if (line.includes('【高】') || line.includes('[高]')) {
          return (
            <div key={idx} className="flex items-start gap-2 py-1">
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-500/20 text-red-400">高</span>
              <span className="text-xs text-[var(--text-primary)] flex-1">
                {line.replace(/【高】|\[高\]/g, '').trim()}
              </span>
            </div>
          );
        }
        if (line.includes('【中】') || line.includes('[中]')) {
          return (
            <div key={idx} className="flex items-start gap-2 py-1">
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-yellow-500/20 text-yellow-400">中</span>
              <span className="text-xs text-[var(--text-primary)] flex-1">
                {line.replace(/【中】|\[中\]/g, '').trim()}
              </span>
            </div>
          );
        }
        if (line.includes('【低】') || line.includes('[低]')) {
          return (
            <div key={idx} className="flex items-start gap-2 py-1">
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400">低</span>
              <span className="text-xs text-[var(--text-primary)] flex-1">
                {line.replace(/【低】|\[低\]/g, '').trim()}
              </span>
            </div>
          );
        }
        
        // 检测风险等级
        if (line.includes('高风险') || line.includes('⚠️')) {
          return (
            <div key={idx} className="text-xs text-red-400 py-0.5">
              {line}
            </div>
          );
        }
        if (line.includes('中等风险') || line.includes('注意')) {
          return (
            <div key={idx} className="text-xs text-yellow-400 py-0.5">
              {line}
            </div>
          );
        }
        if (line.includes('安全') || line.includes('✅')) {
          return (
            <div key={idx} className="text-xs text-green-400 py-0.5">
              {line}
            </div>
          );
        }
        
        // 普通文本
        return (
          <div key={idx} className="text-xs text-[var(--text-secondary)] py-0.5 leading-relaxed">
            {line}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 错误信息
 */
function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
      <span className="text-yellow-500">⚠️</span>
      <span>{message}</span>
    </div>
  );
}

/**
 * 空状态
 */
function EmptyState() {
  return (
    <div className="text-xs text-[var(--text-muted)] text-center py-2">
      等待数据加载...
    </div>
  );
}
