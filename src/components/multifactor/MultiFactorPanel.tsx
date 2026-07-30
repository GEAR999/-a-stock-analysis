"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type {
  StockFactorResult,
  PositionResult,
  SentimentMode,
  StockFactorKey,
} from "@/lib/multifactor/types";
import { FACTOR_LIBRARY, SENTIMENT_MODE_INFO, SCORE_LABELS } from "@/lib/multifactor/types";

interface MultiFactorPanelProps {
  code: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    code: string;
    stockFactors: StockFactorResult;
    sentimentScore: number;
    sentimentMode: string;
    correctionFactor: number;
    position: PositionResult;
  };
  error?: string;
}

export default function MultiFactorPanel({ code }: MultiFactorPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse["data"] | null>(null);
  const [mode, setMode] = useState<SentimentMode>("neutral");
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    for (const f of FACTOR_LIBRARY) {
      if (f.defaultWeight > 0) {
        defaults[f.key] = f.defaultWeight;
      }
    }
    return defaults;
  });

  const fetchAnalysis = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ code, mode });
      // 只传非零权重
      const customWeights: Record<string, number> = {};
      let hasCustom = false;
      for (const [key, w] of Object.entries(weights)) {
        if (w > 0) {
          customWeights[key] = w;
          if (w !== FACTOR_LIBRARY.find((f) => f.key === key)?.defaultWeight) {
            hasCustom = true;
          }
        }
      }
      if (hasCustom) {
        params.set("weights", JSON.stringify(customWeights));
      }

      const res = await fetch(`/api/multifactor?${params.toString()}`);
      const data: ApiResponse = await res.json();

      if (!data.success) {
        setError(data.error || "分析失败");
        setResult(null);
      } else {
        setResult(data.data || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络请求失败");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [code, mode, weights]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // 评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 3) return "text-red-400";
    if (score >= 1) return "text-red-300";
    if (score > -1) return "text-gray-400";
    if (score > -3) return "text-green-300";
    return "text-green-400";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 1) return <TrendingUp className="h-3 w-3" />;
    if (score <= -1) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  // 总权重
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      {/* 控制栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={mode} onValueChange={(v) => setMode(v as SentimentMode)}>
          <SelectTrigger className="w-[100px] h-7 text-xs bg-[#1a2035] border-[#2a3550]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a2035] border-[#2a3550]">
            {(Object.entries(SENTIMENT_MODE_INFO) as [SentimentMode, typeof SENTIMENT_MODE_INFO.neutral][]).map(
              ([key, info]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {info.label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={fetchAnalysis}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <span className="text-[10px] text-gray-500 ml-auto">
          {SENTIMENT_MODE_INFO[mode].desc}
        </span>
      </div>

      {/* 权重配置 */}
      <Card className="bg-[#111827] border-[#1e2a40]">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs text-gray-400">因子权重（总计{totalWeight}%）</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {FACTOR_LIBRARY.map((factor) => {
            const w = weights[factor.key] || 0;
            return (
              <div key={factor.key} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-14 shrink-0">{factor.name}</span>
                <Slider
                  value={[w]}
                  max={100}
                  step={5}
                  className="flex-1"
                  onValueChange={([v]) =>
                    setWeights((prev) => ({ ...prev, [factor.key]: v }))
                  }
                />
                <span className="text-[10px] text-gray-400 w-8 text-right font-mono">{w}%</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <span className="text-xs text-gray-400 ml-2">分析中...</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded px-3 py-2">{error}</div>
      )}

      {/* 分析结果 */}
      {result && !loading && (
        <>
          {/* 综合评分 */}
          <Card className="bg-[#111827] border-[#1e2a40]">
            <CardContent className="px-3 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">综合评分</span>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold font-mono ${getScoreColor(result.stockFactors.totalScore)}`}>
                    {result.stockFactors.totalScore > 0 ? "+" : ""}
                    {result.stockFactors.totalScore.toFixed(2)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      result.stockFactors.totalScore >= 0
                        ? "border-red-500/30 text-red-400"
                        : "border-green-500/30 text-green-400"
                    }`}
                  >
                    {result.stockFactors.signalStrength}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 因子明细 */}
          <Card className="bg-[#111827] border-[#1e2a40]">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs text-gray-400">因子评分明细</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1.5">
              {result.stockFactors.factors.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center justify-between text-xs py-1 border-b border-[#1e2a40] last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-12">{f.name}</span>
                    <span className="text-gray-600 text-[10px]">权重{f.weight}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono ${getScoreColor(f.score)}`}>
                      {getScoreIcon(f.score)}
                      {f.score > 0 ? "+" : ""}
                      {f.score}
                    </span>
                    <span className="text-gray-600 text-[10px] w-24 truncate" title={f.detail}>
                      {f.detail}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 仓位计算 */}
          <Card className="bg-[#111827] border-[#1e2a40] border-l-2 border-l-amber-500">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs text-amber-400">仓位建议</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-gray-500">基础仓位</div>
                  <div className="text-lg font-mono font-bold text-blue-400">
                    {result.position.basePosition}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">修正系数</div>
                  <div className="text-lg font-mono font-bold text-purple-400">
                    x{result.correctionFactor.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">最终仓位</div>
                  <div className="text-lg font-mono font-bold text-amber-400">
                    {result.position.finalPosition}%
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-[#1e2a40]">
                <span>
                  情绪评分: {result.sentimentScore > 0 ? "+" : ""}
                  {result.sentimentScore.toFixed(1)}
                </span>
                <span>
                  模式: {SENTIMENT_MODE_INFO[result.position.sentimentMode as SentimentMode]?.label || result.position.sentimentMode}
                </span>
              </div>
              {/* 仓位条 */}
              <div className="w-full bg-[#1e2a40] rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-amber-500 transition-all duration-500"
                  style={{ width: `${result.position.finalPosition}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
