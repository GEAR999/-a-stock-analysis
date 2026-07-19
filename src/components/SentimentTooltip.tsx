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
        <span className="cursor-help border-b border-dashed border-gray-500 hover:border-gray-300 transition-colors">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        className="max-w-[400px] p-0 border-0"
      >
        <div className="bg-[#0f0f1a] rounded-lg p-4 text-xs space-y-3 shadow-xl border border-gray-800">
          {/* 标题行 */}
          <div className="flex items-center justify-between border-b border-gray-700 pb-2">
            <span className="font-medium text-gray-200">{detail.name}</span>
            <span className="font-mono text-green-400">
              {detail.score}分 × {detail.weight}%
            </span>
          </div>

          {/* 当前值 */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400">当前值:</span>
            <span className="text-white font-medium">{detail.value}</span>
          </div>

          {/* 指标说明 */}
          <div>
            <div className="text-gray-400 mb-1">指标说明</div>
            <div className="text-gray-300 leading-relaxed">
              {detail.description}
            </div>
          </div>

          {/* 计算过程 */}
          <div>
            <div className="text-gray-400 mb-1">计算过程</div>
            <div className="font-mono text-green-400 bg-black/30 rounded px-2 py-1.5 text-[11px] leading-relaxed">
              {detail.calculation}
            </div>
          </div>

          {/* 影响分析 */}
          <div>
            <div className="text-gray-400 mb-1">影响分析</div>
            <div className="text-yellow-400 leading-relaxed">
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
    <div className="flex items-center justify-between py-2 px-3 rounded bg-[#0f0f1a] hover:bg-[#1f1f2e] transition-colors group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SentimentTooltip detail={detail}>
          <span className="text-gray-300 text-xs truncate">{detail.name}</span>
        </SentimentTooltip>
        {showWeight && (
          <span className="text-gray-500 text-[10px] flex-shrink-0">
            {detail.weight}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-gray-400 text-[10px] truncate max-w-[100px]">
          {detail.value}
        </span>
        <span
          className={`font-mono text-sm font-medium ${
            detail.score >= 70
              ? "text-green-400"
              : detail.score >= 40
              ? "text-yellow-400"
              : "text-red-400"
          }`}
        >
          {detail.score}
        </span>
      </div>
    </div>
  );
}
