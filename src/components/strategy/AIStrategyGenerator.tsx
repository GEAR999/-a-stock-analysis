'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Save, X } from 'lucide-react';
import { generateStrategyId, saveCustomStrategy, type StrategyDefinition } from '@/lib/strategy-library';
import type { StrategyType } from '@/lib/backtest-engine';

interface AIStrategyGeneratorProps {
  onSaved: () => void;
}

export function AIStrategyGenerator({ onSaved }: AIStrategyGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<{
    name?: string;
    description?: string;
    buyConditions?: string;
    sellConditions?: string;
    parameters?: Record<string, unknown>;
    aiSummary?: string;
    aiTags?: string[];
  } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `你是一个量化策略专家。用户会描述一个交易策略需求，你需要生成策略的参数和规则。

请严格按照以下JSON格式返回：
{
  "name": "策略名称",
  "description": "策略描述（50字以内）",
  "buyConditions": "买入条件描述",
  "sellConditions": "卖出条件描述",
  "parameters": {
    "指标1": 数值,
    "指标2": 数值
  },
  "aiSummary": "策略分析摘要（100字以内）",
  "aiTags": ["标签1", "标签2"]
}

只返回JSON，不要其他内容。`,
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error('AI服务请求失败');
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || data.data?.content || '';

      // 尝试解析JSON
      try {
        // 提取JSON部分
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setGenerated(parsed);
          setName(parsed.name || '');
          setDescription(parsed.description || '');
        } else {
          setError('AI返回格式异常，请重试');
        }
      } catch {
        setError('解析AI返回数据失败，请重试');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    }

    setLoading(false);
  };

  const handleSave = () => {
    if (!name.trim() || !generated) return;

    const strategy: StrategyDefinition = {
      id: generateStrategyId(),
      name: name.trim(),
      category: 'ai_generated',
      description: description || generated.description || '',
      // 信号配置
      signals: {
        buySignals: (generated.parameters?.buySignals as StrategyType[]) || [],
        sellSignals: (generated.parameters?.sellSignals as StrategyType[]) || [],
        buyLogic: 'OR',
        sellLogic: 'OR',
        minBuyMatch: 1,
        minSellMatch: 1,
      },
      // 仓位控制
      position: {
        maxTotalPosition: 1.0,
        maxSinglePosition: 1.0,
        minCashReserve: 0,
        positionSize: 1.0,
        enablePyramiding: false,
        maxPyramidLevels: 1,
      },
      // 风险控制
      risk: {
        stopLoss: 0,
        takeProfit: 0,
        trailingStop: 0,
        maxHoldingDays: 0,
      },
      // 交易成本
      cost: {
        commission: 0.0003,
        slippage: 0.001,
      },
      aiSummary: generated.aiSummary,
      aiTags: generated.aiTags,
      isFavorite: false,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveCustomStrategy(strategy);
    onSaved();
  };

  return (
    <div className="bg-surface-raised border border-border-subtle rounded p-2.5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-text-primary flex items-center gap-1.5">
          <Sparkles size={12} className="text-purple-400" />
          AI策略生成器
        </h4>
        {generated && (
          <button onClick={() => { setGenerated(null); setPrompt(''); }} className="text-text-secondary hover:text-text-primary">
            <X size={12} />
          </button>
        )}
      </div>

      {!generated ? (
        <div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="描述你想要的策略，例如：当MACD金叉且RSI低于30时买入，当MACD死叉或RSI高于70时卖出"
            className="w-full bg-surface-input border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary resize-none h-16 focus:border-accent-blue focus:outline-none"
          />
          {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 text-purple-400 rounded text-xs hover:bg-purple-500/30 disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {loading ? '生成中...' : '生成策略'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-text-secondary mb-0.5 block">策略名称</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-surface-input border border-border-subtle rounded px-2 py-1 text-xs text-text-primary focus:border-accent-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-secondary mb-0.5 block">分类</label>
              <div className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">AI生成</div>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-text-secondary mb-0.5 block">描述</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-surface-input border border-border-subtle rounded px-2 py-1 text-xs text-text-primary focus:border-accent-blue focus:outline-none"
            />
          </div>
          {generated.buyConditions && (
            <div className="bg-surface-input border border-border-subtle rounded p-2">
              <div className="text-[10px] text-text-secondary mb-0.5">买入条件</div>
              <div className="text-xs text-text-primary">{generated.buyConditions}</div>
            </div>
          )}
          {generated.sellConditions && (
            <div className="bg-surface-input border border-border-subtle rounded p-2">
              <div className="text-[10px] text-text-secondary mb-0.5">卖出条件</div>
              <div className="text-xs text-text-primary">{generated.sellConditions}</div>
            </div>
          )}
          {generated.aiSummary && (
            <div className="bg-surface-input border border-border-subtle rounded p-2">
              <div className="text-[10px] text-text-secondary mb-0.5">AI分析摘要</div>
              <div className="text-xs text-text-primary">{generated.aiSummary}</div>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-blue text-white rounded text-xs hover:bg-accent-blue/90 disabled:opacity-50"
          >
            <Save size={12} />
            保存到策略库
          </button>
        </div>
      )}
    </div>
  );
}
