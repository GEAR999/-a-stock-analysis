"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SentimentDetail } from "@/services/sentiment/types";

interface SentimentTooltipProps {
  detail: SentimentDetail;
  children: React.ReactNode;
}

export function SentimentTooltip({ detail, children }: SentimentTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help border-b border-dashed border-[var(--text-secondary)] hover:border-[var(--text-secondary)] transition-colors">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        className="max-w-[400px] p-0 border-0"
      >
        <div className="bg-[var(--bg-primary)] rounded-lg p-4 text-xs space-y-3 shadow-xl border border-[var(--border-default)]">
          {/* 标题行 */}
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
            <span className="font-medium text-[var(--text-primary)]">{detail.name}</span>
            <span className="font-mono text-[var(--accent-green)]">
              {detail.score}分 × {detail.weight}%
            </span>
          </div>

          {/* 当前值 */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-secondary)]">当前值:</span>
            <span className="text-[var(--text-primary)] font-medium">{detail.value}</span>
          </div>

          {/* 指标说明 */}
          <div>
            <div className="text-[var(--text-secondary)] mb-1">指标说明</div>
            <div className="text-[var(--text-primary)] leading-relaxed">
              {detail.description}
            </div>
          </div>

          {/* 计算过程 */}
          <div>
            <div className="text-[var(--text-secondary)] mb-1">计算过程</div>
            <div className="font-mono text-[var(--accent-green)] bg-black/30 rounded px-2 py-1.5 text-[11px] leading-relaxed">
              {detail.calculation}
            </div>
          </div>

          {/* 影响分析 */}
          <div>
            <div className="text-[var(--text-secondary)] mb-1">影响分析</div>
            <div className="text-[var(--accent-yellow)] leading-relaxed">
              {detail.impact}
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// 指标行组件
interface SentimentRowProps {
  detail: SentimentDetail;
  showWeight?: boolean;
}

export function SentimentRow({ detail, showWeight = true }: SentimentRowProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded bg-[var(--bg-primary)] hover:bg-[var(--bg-panel)] transition-colors group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SentimentTooltip detail={detail}>
          <span className="text-[var(--text-primary)] text-xs truncate">{detail.name}</span>
        </SentimentTooltip>
        {showWeight && (
          <span className="text-[var(--text-secondary)] text-[10px] flex-shrink-0">
            {detail.weight}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[var(--text-secondary)] text-[10px] truncate max-w-[100px]">
          {detail.value}
        </span>
        <span
          className={`font-mono text-sm font-medium ${
            detail.score >= 70
              ? "text-[var(--accent-green)]"
              : detail.score >= 40
              ? "text-[var(--accent-yellow)]"
              : "text-[var(--accent-red)]"
          }`}
        >
          {detail.score}
        </span>
      </div>
    </div>
  );
}
