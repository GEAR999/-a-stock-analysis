"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";

// ============ 类型定义 ============

interface MacroChinaRow {
  period: string;
  pmi: number | null;
  cpi: number | null;
  ppi: number | null;
  social_financing: number | null;
  m2_growth: number | null;
  gdp_yoy: number | null;
  status?: string;
  message?: string;
}

interface MacroUsRow {
  period: string;
  cpi: number | null;
  core_pce: number | null;
  nonfarm_payroll: number | null;
  unemployment_rate: number | null;
  fed_rate: number | null;
  status?: string;
  message?: string;
}

interface RateRow {
  bank: string;
  rate: number | null;
  updated_at?: string;
}

interface MacroEconomyPanelProps {
  enabled: boolean;
}

// ============ 经济体配置 ============

const ECONOMIES = [
  {
    id: "china" as const,
    name: "中国",
    flag: "🇨🇳",
    impact: 5,
    impactLabel: "决定性",
  },
  {
    id: "us" as const,
    name: "美国",
    flag: "🇺🇸",
    impact: 5,
    impactLabel: "重要",
  },
  {
    id: "europe" as const,
    name: "欧洲",
    flag: "🇪🇺",
    impact: 3,
    impactLabel: "一般",
  },
  {
    id: "japan" as const,
    name: "日本",
    flag: "🇯🇵",
    impact: 4,
    impactLabel: "较重要",
  },
  {
    id: "korea" as const,
    name: "韩国",
    flag: "🇰🇷",
    impact: 4,
    impactLabel: "较重要",
  },
];

// 指标格式化
function fmtVal(v: number | string | null | undefined, suffix: string = ""): string {
  if (v === null || v === undefined || v === "") return "--";
  const n = Number(v);
  if (isNaN(n)) return "--";
  return n.toFixed(2) + suffix;
}

// 趋势箭头
function trendArrow(cur: number | string | null, prev: number | string | null): string {
  const c = cur !== null ? Number(cur) : null;
  const p = prev !== null ? Number(prev) : null;
  if (c === null || p === null || isNaN(c) || isNaN(p)) return "--";
  if (c > p) return "↑";
  if (c < p) return "↓";
  return "→";
}

function trendColor(cur: number | string | null, prev: number | string | null): string {
  const c = cur !== null ? Number(cur) : null;
  const p = prev !== null ? Number(prev) : null;
  if (c === null || p === null || isNaN(c) || isNaN(p)) return "text-gray-500";
  if (c > p) return "text-red-400";
  if (c < p) return "text-green-400";
  return "text-gray-400";
}

export function MacroEconomyPanel({ enabled }: MacroEconomyPanelProps) {
  const [expandedEconomy, setExpandedEconomy] = useState<string | null>("china");
  const [chinaData, setChinaData] = useState<MacroChinaRow[]>([]);
  const [usData, setUsData] = useState<MacroUsRow[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chinaRes, usRes, ratesRes] = await Promise.all([
        fetch("/api/macro?region=china&limit=12"),
        fetch("/api/macro?region=us&limit=12"),
        fetch("/api/rates"),
      ]);
      const [china, us, rateData] = await Promise.all([
        chinaRes.json(),
        usRes.json(),
        ratesRes.json(),
      ]);
      if (china.success) setChinaData(china.data || []);
      if (us.success) setUsData(us.data || []);
      if (rateData.success) setRates(rateData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) fetchData();
  }, [enabled, fetchData]);

  if (!enabled) return null;

  const getImpactStars = (impact: number) => {
    return "★".repeat(impact) + "☆".repeat(5 - impact);
  };

  // 获取利率
  const getRate = (bank: string): RateRow | undefined => {
    return rates.find((r) => r.bank === bank);
  };

  // 构建中国指标数据
  const buildChinaIndicators = () => {
    const latest = chinaData[0];
    const prev = chinaData[1];
    if (!latest) return [];
    return [
      { name: "GDP同比", cur: latest.gdp_yoy, prev: prev?.gdp_yoy ?? null, suffix: "%" },
      { name: "PMI", cur: latest.pmi, prev: prev?.pmi ?? null, suffix: "" },
      { name: "CPI", cur: latest.cpi, prev: prev?.cpi ?? null, suffix: "%" },
      { name: "PPI", cur: latest.ppi, prev: prev?.ppi ?? null, suffix: "%" },
      { name: "社融增量", cur: latest.social_financing, prev: prev?.social_financing ?? null, suffix: "" },
      { name: "M2增速", cur: latest.m2_growth, prev: prev?.m2_growth ?? null, suffix: "%" },
    ];
  };

  // 构建美国指标数据
  const buildUsIndicators = () => {
    const latest = usData[0];
    const prev = usData[1];
    if (!latest) return [];
    return [
      { name: "联邦基金利率", cur: latest.fed_rate, prev: prev?.fed_rate ?? null, suffix: "%" },
      { name: "CPI", cur: latest.cpi, prev: prev?.cpi ?? null, suffix: "%" },
      { name: "核心PCE", cur: latest.core_pce, prev: prev?.core_pce ?? null, suffix: "%" },
      { name: "非农就业", cur: latest.nonfarm_payroll, prev: prev?.nonfarm_payroll ?? null, suffix: "万" },
      { name: "失业率", cur: latest.unemployment_rate, prev: prev?.unemployment_rate ?? null, suffix: "%" },
    ];
  };

  // 渲染经济体内容
  const renderEconomyContent = (economyId: string) => {
    if (economyId === "china") {
      const indicators = buildChinaIndicators();
      const latest = chinaData[0];
      if (indicators.length === 0) {
        return <div className="text-[10px] text-gray-500 py-2 text-center">暂无推送数据</div>;
      }
      return (
        <div className="space-y-2">
          <div className="text-[9px] text-gray-500">数据期：{latest.period}</div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-gray-500 border-b border-[var(--border-default)]">
                <th className="text-left py-1 pr-2">指标</th>
                <th className="text-right py-1 px-1">当前</th>
                <th className="text-right py-1 px-1">前值</th>
                <th className="text-center py-1 pl-1">趋势</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((ind, i) => (
                <tr key={i} className="border-b border-[var(--border-default)]/50">
                  <td className="py-1 pr-2 text-gray-400">{ind.name}</td>
                  <td className="py-1 px-1 text-right text-gray-200 font-mono">{fmtVal(ind.cur, ind.suffix)}</td>
                  <td className="py-1 px-1 text-right text-gray-500 font-mono">{fmtVal(ind.prev, ind.suffix)}</td>
                  <td className={`py-1 pl-1 text-center font-mono ${trendColor(ind.cur, ind.prev)}`}>
                    {trendArrow(ind.cur, ind.prev)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {latest.message && (
            <div className="text-[9px] text-gray-500 pt-1 border-t border-[var(--border-default)]">
              {latest.message}
            </div>
          )}
        </div>
      );
    }

    if (economyId === "us") {
      const indicators = buildUsIndicators();
      const latest = usData[0];
      if (indicators.length === 0) {
        return <div className="text-[10px] text-gray-500 py-2 text-center">暂无推送数据</div>;
      }
      return (
        <div className="space-y-2">
          <div className="text-[9px] text-gray-500">数据期：{latest.period}</div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-gray-500 border-b border-[var(--border-default)]">
                <th className="text-left py-1 pr-2">指标</th>
                <th className="text-right py-1 px-1">当前</th>
                <th className="text-right py-1 px-1">前值</th>
                <th className="text-center py-1 pl-1">趋势</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((ind, i) => (
                <tr key={i} className="border-b border-[var(--border-default)]/50">
                  <td className="py-1 pr-2 text-gray-400">{ind.name}</td>
                  <td className="py-1 px-1 text-right text-gray-200 font-mono">{fmtVal(ind.cur, ind.suffix)}</td>
                  <td className="py-1 px-1 text-right text-gray-500 font-mono">{fmtVal(ind.prev, ind.suffix)}</td>
                  <td className={`py-1 pl-1 text-center font-mono ${trendColor(ind.cur, ind.prev)}`}>
                    {trendArrow(ind.cur, ind.prev)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {latest.message && (
            <div className="text-[9px] text-gray-500 pt-1 border-t border-[var(--border-default)]">
              {latest.message}
            </div>
          )}
        </div>
      );
    }

    // 欧洲/日本/韩国：从央行利率表读取
    const rateMap: Record<string, string> = {
      europe: "ECB",
      japan: "BOJ",
      korea: "BOK",
    };
    const bankCode = rateMap[economyId];
    const rate = getRate(bankCode);
    if (rate && rate.rate !== null) {
      return (
        <div className="space-y-2">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-gray-500 border-b border-[var(--border-default)]">
                <th className="text-left py-1 pr-2">指标</th>
                <th className="text-right py-1 px-1">当前</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border-default)]/50">
                <td className="py-1 pr-2 text-gray-400">{bankCode}基准利率</td>
                <td className="py-1 px-1 text-right text-gray-200 font-mono">{fmtVal(rate.rate, "%")}</td>
              </tr>
            </tbody>
          </table>
          {rate.updated_at && (
            <div className="text-[9px] text-gray-500">
              更新时间：{new Date(rate.updated_at).toLocaleDateString()}
            </div>
          )}
        </div>
      );
    }
    return <div className="text-[10px] text-gray-500 py-2 text-center">暂无推送数据</div>;
  };

  // 综合评级
  const buildSummary = (): { conclusion: string; strategy: string; risk: string } => {
    const chinaLatest = chinaData[0];
    const usLatest = usData[0];

    if (!chinaLatest && !usLatest) {
      return { conclusion: "暂无数据", strategy: "暂无数据", risk: "暂无数据" };
    }

    const parts: string[] = [];
    let riskLevel = "低";

    if (chinaLatest) {
      const cpi = chinaLatest.cpi !== null ? Number(chinaLatest.cpi) : null;
      const pmi = chinaLatest.pmi !== null ? Number(chinaLatest.pmi) : null;
      const m2 = chinaLatest.m2_growth !== null ? Number(chinaLatest.m2_growth) : null;
      if (cpi !== null && !isNaN(cpi) && cpi < 1) parts.push("中国CPI低位运行");
      if (pmi !== null && !isNaN(pmi) && pmi < 50) {
        parts.push("中国PMI低于荣枯线");
        riskLevel = "中";
      }
      if (m2 !== null && !isNaN(m2) && m2 > 10) parts.push("中国M2增速较高");
    }

    if (usLatest) {
      const cpi = usLatest.cpi !== null ? Number(usLatest.cpi) : null;
      const fedRate = usLatest.fed_rate !== null ? Number(usLatest.fed_rate) : null;
      const unemploy = usLatest.unemployment_rate !== null ? Number(usLatest.unemployment_rate) : null;
      if (cpi !== null && !isNaN(cpi) && cpi > 3) {
        parts.push("美国CPI偏高");
        riskLevel = "中";
      }
      if (fedRate !== null && !isNaN(fedRate) && fedRate > 4) {
        parts.push("美联储维持高利率");
        riskLevel = "中";
      }
      if (unemploy !== null && !isNaN(unemploy) && unemploy > 5) {
        parts.push("美国失业率上升");
        riskLevel = "高";
      }
    }

    const conclusion = parts.length > 0 ? parts.join("，") : "宏观经济数据正常";
    const strategy = riskLevel === "高"
      ? "建议谨慎操作，降低仓位"
      : riskLevel === "中"
      ? "建议适度仓位，关注政策变化"
      : "宏观环境平稳，可正常操作";

    return { conclusion, strategy, risk: riskLevel + "风险" };
  };

  const summary = buildSummary();
  const riskColor = summary.risk.includes("高")
    ? "text-red-400"
    : summary.risk.includes("中")
    ? "text-yellow-400"
    : "text-green-400";

  return (
    <div className="bg-[var(--bg-primary)] border border-amber-500/30 rounded overflow-hidden">
      {/* 标题 */}
      <div className="px-3 py-2 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-amber-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">🌐</span>
            <span className="text-xs font-medium text-amber-400">宏观经济分析</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">
              数据源：{chinaData.length > 0 || usData.length > 0 ? "李富贵推送" : "无"}
            </span>
            <button onClick={fetchData} className="text-gray-500 hover:text-gray-300" disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span className="text-[10px] text-gray-400 ml-2">加载中...</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="text-[10px] text-red-400 px-3 py-2">{error}</div>
      )}

      {/* 经济体列表 */}
      {!loading && (
        <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
          {ECONOMIES.map(economy => (
            <div key={economy.id} className="border border-[var(--border-default)] rounded overflow-hidden">
              {/* 经济体标题 */}
              <div
                onClick={() => setExpandedEconomy(expandedEconomy === economy.id ? null : economy.id)}
                className="px-2 py-1.5 bg-[var(--bg-panel)] cursor-pointer hover:bg-[var(--bg-card)] flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{economy.flag}</span>
                  <span className="text-xs text-[var(--text-primary)]">{economy.name}</span>
                  <span className="text-[10px] text-amber-400">{getImpactStars(economy.impact)}</span>
                </div>
                <span className="text-[var(--text-secondary)] text-[10px]">
                  {expandedEconomy === economy.id ? "▼" : "▶"}
                </span>
              </div>

              {/* 展开内容 */}
              {expandedEconomy === economy.id && (
                <div className="px-2 py-2 bg-[var(--bg-primary)]">
                  {renderEconomyContent(economy.id)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 综合评估 */}
      {!loading && (
        <div className="p-2 border-t border-amber-500/20 bg-[var(--bg-primary)]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-amber-400">📊</span>
            <span className="text-xs text-amber-400 font-medium">综合评估</span>
          </div>
          <div className="space-y-1 text-[10px]">
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0">结论:</span>
              <span className="text-gray-300">{summary.conclusion}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0">策略:</span>
              <span className="text-gray-300">{summary.strategy}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0">风险:</span>
              <span className={riskColor}>{summary.risk}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
