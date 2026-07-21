"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Bot, AlertTriangle, Shield, CheckCircle, Lock } from "lucide-react";
import type { Account } from "./types";
import { formatMoney, formatPercent } from "./utils";
import { isAIEmbedEnabled, callEmbeddedAI } from "@/lib/ai-embed";

interface AccountOverviewProps {
  account: Account;
}

function AIRiskAlert({ account }: { account: Account }) {
  const enabled = isAIEmbedEnabled();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [riskLevel, setRiskLevel] = useState<"high" | "medium" | "low" | null>(null);

  useEffect(() => {
    if (!enabled || !expanded || result) return;

    const analyze = async () => {
      setLoading(true);
      try {
        const totalAssets = account.currentCapital + account.positions.reduce((sum, p) => sum + p.quantity * p.avgCost, 0);
        const positions = account.positions.map(p => ({
          code: p.stockCode,
          name: p.stockName,
          quantity: p.quantity,
          avgCost: p.avgCost,
          currentValue: p.quantity * p.avgCost,
          pnl: p.pnl,
          pnlPercent: p.pnlPercent,
          positionPercent: ((p.quantity * p.avgCost) / totalAssets * 100).toFixed(1),
        }));

        const res = await callEmbeddedAI({
          prompt: "分析持仓风险，给出：1)仓位集中度风险 2)行业暴露分析 3)最大回撤预警 4)建议操作。用risk_level标注风险等级(high/medium/low)。",
          context: {
            type: "position_risk",
            positions,
            totalAssets,
            cash: account.currentCapital,
            cashPercent: (account.currentCapital / totalAssets * 100).toFixed(1),
          },
        });
        const content = res.content || "AI分析暂不可用";
        setResult(content);
        // Extract risk level from content
        if (content.includes("高风险") || content.includes("risk_level: high")) {
          setRiskLevel("high");
        } else if (content.includes("中等风险") || content.includes("risk_level: medium")) {
          setRiskLevel("medium");
        } else {
          setRiskLevel("low");
        }
      } catch {
        setResult("AI分析暂不可用");
      } finally {
        setLoading(false);
      }
    };
    analyze();
  }, [enabled, expanded, account, result]);

  if (!enabled) return null;

  const riskColors = {
    high: "border-[var(--accent-red)]/50 bg-[var(--accent-red)]/5",
    medium: "border-[var(--accent-yellow)]/50 bg-[var(--accent-yellow)]/5",
    low: "border-[var(--accent-green)]/50 bg-[var(--accent-green)]/5",
  };

  const riskIcons = {
    high: <AlertTriangle className="w-4 h-4 text-[var(--accent-red)]" />,
    medium: <Shield className="w-4 h-4 text-[var(--accent-yellow)]" />,
    low: <CheckCircle className="w-4 h-4 text-[var(--accent-green)]" />,
  };

  const riskLabels = {
    high: "高风险",
    medium: "中等风险",
    low: "安全",
  };

  return (
    <div className={`mt-3 rounded border ${riskLevel ? riskColors[riskLevel] : "border-[var(--border-default)]"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[var(--accent-blue)]" />
          <span className="font-medium text-[var(--text-primary)]">AI风险提示</span>
          {riskLevel && (
            <div className="flex items-center gap-1">
              {riskIcons[riskLevel]}
              <span className={`text-[10px] ${
                riskLevel === "high" ? "text-[var(--accent-red)]" :
                riskLevel === "medium" ? "text-[var(--accent-yellow)]" :
                "text-[var(--accent-green)]"
              }`}>{riskLabels[riskLevel]}</span>
            </div>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <div className="w-3 h-3 border border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
              AI正在分析持仓风险...
            </div>
          ) : result ? (
            <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
              {result}
            </div>
          ) : (
            <div className="text-xs text-[var(--text-muted)]">点击展开查看AI风险分析</div>
          )}
        </div>
      )}
    </div>
  );
}

export function AccountOverview({ account }: AccountOverviewProps) {
  const totalAssets = account.currentCapital + account.positions.reduce((sum, p) => sum + p.quantity * p.avgCost, 0);
  const totalPnL = totalAssets - account.initialCapital;
  const totalPnLPercent = (totalPnL / account.initialCapital) * 100;

  return (
    <div>
      {account.locked && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
          <Lock className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] text-amber-400">策略已锁定 - 创建后不可更改策略参数、止盈止损比例和仓位上限</span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
          <div className="text-[10px] text-[var(--text-secondary)] mb-1">总资产</div>
          <div className="text-sm font-medium text-[var(--text-primary)] font-mono">{formatMoney(totalAssets)}</div>
        </div>
        <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
          <div className="text-[10px] text-[var(--text-secondary)] mb-1">总盈亏</div>
          <div className={`text-sm font-medium font-mono ${totalPnL >= 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
            {formatMoney(totalPnL)} ({formatPercent(totalPnLPercent)})
          </div>
        </div>
        <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
          <div className="text-[10px] text-[var(--text-secondary)] mb-1">持仓数</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{account.positions.length} 只</div>
        </div>
        <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
          <div className="text-[10px] text-[var(--text-secondary)] mb-1">可用资金</div>
          <div className="text-sm font-medium text-[var(--text-primary)] font-mono">{formatMoney(account.currentCapital)}</div>
        </div>
      </div>
      {account.positions.length > 0 && <AIRiskAlert account={account} />}
    </div>
  );
}
