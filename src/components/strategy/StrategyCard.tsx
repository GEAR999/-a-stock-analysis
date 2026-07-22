'use client';

import { Star, Trash2, Copy, Edit, Eye } from 'lucide-react';
import type { StrategyDefinition } from '@/lib/strategy-library';

interface StrategyCardProps {
  strategy: StrategyDefinition;
  onToggleFavorite: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  builtin: 'bg-accent-blue/20 text-accent-blue',
  custom: 'bg-amber-500/20 text-amber-400',
  ai_generated: 'bg-purple-500/20 text-purple-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  builtin: '内置',
  custom: '自定义',
  ai_generated: 'AI',
};

export function StrategyCard({ strategy, onToggleFavorite, onDelete, onEdit, onView }: StrategyCardProps) {
  const isBuiltin = strategy.id.startsWith('builtin_');

  return (
    <div className="bg-surface-input border border-border-subtle rounded p-2 hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0" onClick={() => onView?.(strategy.id)} role="button" tabIndex={0}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-medium text-text-primary truncate">{strategy.name}</span>
            <span className={`px-1 py-0 rounded text-[8px] ${CATEGORY_COLORS[strategy.category] || 'bg-surface-raised text-text-secondary'}`}>
              {CATEGORY_LABELS[strategy.category] || strategy.category}
            </span>
            {strategy.isFavorite && (
              <Star size={10} className="text-amber-400 fill-amber-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-[10px] text-text-secondary line-clamp-2">{strategy.description}</p>
          {strategy.usageCount > 0 && (
            <div className="flex items-center gap-2 mt-1 text-[9px] text-text-secondary">
              <span>使用{strategy.usageCount}次</span>
              {strategy.lastUsedAt && (
                <span>最近: {new Date(strategy.lastUsedAt).toLocaleDateString()}</span>
              )}
            </div>
          )}
          {strategy.aiTags && strategy.aiTags.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {strategy.aiTags.map((tag, i) => (
                <span key={i} className="px-1 py-0 bg-surface-raised rounded text-[8px] text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onToggleFavorite(strategy.id)}
            className={`p-1 rounded hover:bg-surface-hover ${strategy.isFavorite ? 'text-amber-400' : 'text-text-secondary'}`}
            title={strategy.isFavorite ? '取消收藏' : '收藏'}
          >
            {strategy.isFavorite ? <Star size={11} className="fill-current" /> : <Star size={11} />}
          </button>
          {isBuiltin && onView && (
            <button
              onClick={() => onView(strategy.id)}
              className="p-1 text-text-secondary hover:text-accent-blue rounded hover:bg-surface-hover"
              title="查看详情"
            >
              <Eye size={11} />
            </button>
          )}
          {!isBuiltin && onEdit && (
            <button
              onClick={() => onEdit(strategy.id)}
              className="p-1 text-text-secondary hover:text-accent-blue rounded hover:bg-surface-hover"
              title="编辑"
            >
              <Edit size={11} />
            </button>
          )}
          {!isBuiltin && onDelete && (
            <button
              onClick={() => onDelete(strategy.id)}
              className="p-1 text-text-secondary hover:text-red-400 rounded hover:bg-surface-hover"
              title="删除"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
