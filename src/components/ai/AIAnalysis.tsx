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
  const [useFallback, setUseFallback] = useState(false);

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
    setUseFallback(false); // 重置降级状态
    
    const analyze = async () => {
      setLoading(true);
      setResult(null);
      
      try {
        const response = await callEmbeddedAI({ prompt, context });
        setResult(response);
        
        // 如果 API 失败，自动降级为本地规则
        if (!response.success) {
          setUseFallback(true);
        }
      } catch (error) {
        // 异常也降级
        setUseFallback(true);
      }
      
      setLoading(false);
    };

    // 延迟300ms执行，避免频繁请求
    const timer = setTimeout(analyze, 300);
    return () => clearTimeout(timer);
  }, [enabled, visible, prompt, context, generateHash]);

  if (!enabled || !visible) return null;

  // API 失败时使用本地降级
  if (useFallback) {
    const fallbackContent = generateLocalFallback(type, context);
    return (
      <AIEmbedSection title={title} className={className}>
        <AnalysisContent type={type} content={fallbackContent} />
        <div className="mt-2 text-[10px] text-[var(--text-muted)] flex items-center gap-1">
          <span>⚠️</span>
          <span>AI 服务不可用，已切换为本地规则分析</span>
        </div>
      </AIEmbedSection>
    );
  }

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
 * 本地规则生成降级（当API失败时使用）
 */
function generateLocalFallback(type: string, context: Record<string, any>): string {
  const lines: string[] = [];
  
  // 根据类型生成不同的本地解读
  if (type === 'summary' || type === 'review') {
    // 综合点评/复盘
    const direction = context.direction || context.overallDirection || '中性';
    const riskLevel = context.riskLevel || '中';
    const enabledCount = context.enabledCount || 0;
    
    lines.push(`【综合研判】当前市场方向：${direction}，风险等级：${riskLevel}`);
    lines.push('');
    
    if (direction === '看多') {
      lines.push('【操作建议】市场偏多，可适当参与，但需注意仓位控制');
      lines.push('【关注重点】量能是否持续放大，板块轮动是否健康');
    } else if (direction === '看空') {
      lines.push('【操作建议】市场偏空，建议轻仓或空仓观望');
      lines.push('【关注重点】等待企稳信号，如底分型、MACD 金叉等');
    } else {
      lines.push('【操作建议】市场方向不明，建议观望或轻仓试探');
      lines.push('【关注重点】等待方向选择，突破后再跟进');
    }
    
    lines.push('');
    lines.push(`【分析依据】基于${enabledCount}个分析理论综合判断`);
  }
  
  return lines.join('\n');
}

/**
 * 错误信息（带降级）
 */
function ErrorMessage({ message, onFallback, type, context }: { message: string; onFallback?: () => void; type?: string; context?: Record<string, any> }) {
  // 如果有降级函数，自动调用
  useEffect(() => {
    if (onFallback) {
      onFallback();
    }
  }, [onFallback]);
  
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
