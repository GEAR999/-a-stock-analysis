/**
 * AI嵌入式分析工具
 * 用于在各模块中嵌入AI分析功能
 */

export interface AIEmbedRequest {
  prompt: string;        // 给AI的具体指令
  context: Record<string, any>;  // 上下文数据
}

export interface AIEmbedResponse {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * 调用嵌入式AI分析
 * @param request AI请求参数
 * @returns AI分析结果
 */
export async function callEmbeddedAI(request: AIEmbedRequest): Promise<AIEmbedResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: request.prompt }],
        context: request.context,
        stream: false, // 嵌入式分析不需要流式
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Embed] API error:', errorText);
      return { success: false, error: 'AI分析服务暂时不可用' };
    }

    const data = await response.json();
    
    if (data.content) {
      return { success: true, content: data.content };
    } else {
      return { success: false, error: data.error || 'AI分析返回为空' };
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.warn('[AI Embed] Request timeout');
      return { success: false, error: 'AI分析超时，请稍后重试' };
    }
    
    console.error('[AI Embed] Error:', error);
    return { success: false, error: 'AI分析暂不可用' };
  }
}

/**
 * 检查AI嵌入功能是否启用
 */
export function isAIEmbedEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('ai_embed_enabled');
  return stored !== 'false'; // 默认启用
}

/**
 * 设置AI嵌入功能开关
 */
export function setAIEmbedEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ai_embed_enabled', String(enabled));
}

/**
 * 格式化上下文数据为AI可读的文本
 */
export function formatContextForAI(context: Record<string, any>): string {
  const lines: string[] = [];
  
  for (const [key, value] of Object.entries(context)) {
    if (value === null || value === undefined) continue;
    
    if (Array.isArray(value)) {
      lines.push(`【${key}】共${value.length}条数据`);
      // 只显示前5条作为示例
      value.slice(0, 5).forEach((item, idx) => {
        if (typeof item === 'object') {
          lines.push(`  ${idx + 1}. ${JSON.stringify(item)}`);
        } else {
          lines.push(`  ${idx + 1}. ${item}`);
        }
      });
      if (value.length > 5) {
        lines.push(`  ... 还有${value.length - 5}条`);
      }
    } else if (typeof value === 'object') {
      lines.push(`【${key}】`);
      for (const [k, v] of Object.entries(value)) {
        lines.push(`  ${k}: ${v}`);
      }
    } else {
      lines.push(`【${key}】${value}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * React Hook for AI Embed
 * 用于在React组件中使用AI嵌入功能
 */
import { useState, useCallback } from 'react';

interface UseAIEmbedOptions {
  prompt: string;
  context: Record<string, any>;
  autoLoad?: boolean;
}

interface UseAIEmbedReturn {
  content: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAIEmbed(options: UseAIEmbedOptions): UseAIEmbedReturn {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAIEmbedEnabled()) {
      setContent(null);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await callEmbeddedAI({
      prompt: options.prompt,
      context: options.context,
    });

    if (result.success && result.content) {
      setContent(result.content);
    } else {
      setError(result.error || 'AI分析失败');
      setContent(null);
    }

    setLoading(false);
  }, [options.prompt, JSON.stringify(options.context)]);

  // Auto load on mount if enabled
  useState(() => {
    if (options.autoLoad !== false) {
      load();
    }
  });

  return {
    content,
    loading,
    error,
    reload: load,
  };
}
