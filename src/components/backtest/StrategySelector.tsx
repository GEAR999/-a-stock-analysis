"use client";

import { useState, useEffect } from "react";
import { getAllCustomStrategies } from "@/components/backtest/strategy-storage";
import type { CustomStrategy, StrategyWeight, StrategyTemplate } from "@/components/backtest/types";

// 系统内置策略
const BUILTIN_STRATEGIES = [
  { id: "chanlun", name: "缠论策略", description: "基于缠论买卖点信号", confidence: 0.75, category: "chanlun" },
  { id: "wave", name: "波浪策略", description: "基于波浪理论浪型分析", confidence: 0.7, category: "wave" },
  { id: "technical", name: "技术指标策略", description: "基于MACD/KDJ/RSI等指标", confidence: 0.8, category: "technical" },
  { id: "ma", name: "均线策略", description: "基于均线系统交叉信号", confidence: 0.65, category: "technical" },
  { id: "boll", name: "布林带策略", description: "基于布林带突破信号", confidence: 0.7, category: "technical" },
];

interface StrategySelectorProps {
  selectedStrategies: StrategyWeight[];
  onChange: (strategies: StrategyWeight[]) => void;
  tradeThreshold?: number;
  onThresholdChange?: (threshold: number) => void;
}

export function StrategySelector({ selectedStrategies, onChange, tradeThreshold = 60, onThresholdChange }: StrategySelectorProps) {
  const [customStrategies, setCustomStrategies] = useState<CustomStrategy[]>([]);
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [filter, setFilter] = useState<"all" | "builtin" | "custom">("all");

  useEffect(() => {
    setCustomStrategies(getAllCustomStrategies());
    // Load templates from localStorage
    const saved = localStorage.getItem("strategy_templates");
    if (saved) {
      try { setTemplates(JSON.parse(saved)); } catch {}
    }
  }, []);

  const allStrategies: Array<{ id: string; name: string; description: string; confidence: number; category: string; isCustom: boolean }> = [
    ...BUILTIN_STRATEGIES.map(s => ({ ...s, isCustom: false as const })),
    ...customStrategies.map(s => ({ id: s.id, name: s.name, description: `自定义策略：${s.theories.join("+")}`, confidence: 0.7, category: "custom", isCustom: true as const })),
  ];

  const filteredStrategies = filter === "all" ? allStrategies :
    filter === "builtin" ? allStrategies.filter(s => !s.isCustom) :
    allStrategies.filter(s => s.isCustom);

  const toggleStrategy = (strategyId: string, strategyName: string, confidence: number, isCustom: boolean) => {
    const existing = selectedStrategies.find(s => s.strategyId === strategyId);
    if (existing) {
      onChange(selectedStrategies.filter(s => s.strategyId !== strategyId));
    } else {
      onChange([...selectedStrategies, { strategyId, strategyName, weight: 0, confidence, enabled: true, source: isCustom ? "custom" : "builtin" }]);
    }
  };

  const updateWeight = (strategyId: string, weight: number) => {
    onChange(selectedStrategies.map(s => s.strategyId === strategyId ? { ...s, weight } : s));
  };

  const totalWeight = selectedStrategies.reduce((sum, s) => sum + s.weight, 0);

  const equalizeWeights = () => {
    if (selectedStrategies.length === 0) return;
    const equalWeight = Math.floor(100 / selectedStrategies.length);
    const remainder = 100 - equalWeight * selectedStrategies.length;
    onChange(selectedStrategies.map((s, i) => ({ ...s, weight: equalWeight + (i === 0 ? remainder : 0) })));
  };

  const distributeByConfidence = () => {
    if (selectedStrategies.length === 0) return;
    const totalConfidence = selectedStrategies.reduce((sum, s) => sum + s.confidence, 0);
    if (totalConfidence === 0) { equalizeWeights(); return; }
    const weights = selectedStrategies.map(s => Math.round((s.confidence / totalConfidence) * 100));
    const diff = 100 - weights.reduce((a, b) => a + b, 0);
    weights[0] += diff;
    onChange(selectedStrategies.map((s, i) => ({ ...s, weight: weights[i] })));
  };

  const saveTemplate = () => {
    const name = prompt("请输入模板名称：");
    if (!name) return;
    const template: StrategyTemplate = {
      id: `tpl_${Date.now()}`,
      name,
      weights: selectedStrategies,
      tradeThreshold: tradeThreshold || 60,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const newTemplates = [...templates, template];
    setTemplates(newTemplates);
    localStorage.setItem("strategy_templates", JSON.stringify(newTemplates));
  };

  const loadTemplate = (template: StrategyTemplate) => {
    onChange(template.weights);
    onThresholdChange?.(template.tradeThreshold);
  };

  const deleteTemplate = (id: string) => {
    const newTemplates = templates.filter(t => t.id !== id);
    setTemplates(newTemplates);
    localStorage.setItem("strategy_templates", JSON.stringify(newTemplates));
  };

  const exportConfig = () => {
    const config = { strategies: selectedStrategies, tradeThreshold };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategy_config_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const config = JSON.parse(ev.target?.result as string);
          if (config.strategies) onChange(config.strategies);
          if (config.tradeThreshold) onThresholdChange?.(config.tradeThreshold);
        } catch { alert("配置文件格式错误"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="bg-[#111827] rounded border border-gray-800 p-3 space-y-3">
      {/* 步骤指示器 */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <button key={s} onClick={() => setStep(s as 1 | 2 | 3)}
            className={`flex-1 px-2 py-1.5 text-[10px] rounded transition-colors ${
              step === s ? "bg-blue-500/20 text-blue-400 border border-blue-500/50" : "bg-gray-800/50 text-gray-500 hover:text-gray-400"
            }`}>
            {s === 1 ? "选择策略" : s === 2 ? "配置权重" : "交易阈值"}
          </button>
        ))}
      </div>

      {/* 步骤1：选择策略 */}
      {step === 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">选择要使用的策略（可多选）</span>
            <div className="flex gap-1">
              {(["all", "builtin", "custom"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 text-[10px] rounded ${filter === f ? "bg-blue-500/20 text-blue-400" : "text-gray-500 hover:text-gray-400"}`}>
                  {f === "all" ? "全部" : f === "builtin" ? "内置" : "自定义"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1.5 max-h-[200px] overflow-y-auto">
            {filteredStrategies.map(strategy => {
              const isSelected = selectedStrategies.some(s => s.strategyId === strategy.id);
              return (
                <button key={strategy.id} onClick={() => toggleStrategy(strategy.id, strategy.name, strategy.confidence, strategy.isCustom)}
                  className={`flex items-center gap-2 p-2 rounded text-left transition-colors ${
                    isSelected ? "bg-blue-500/10 border border-blue-500/50" : "bg-gray-800/30 border border-transparent hover:border-gray-700"
                  }`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? "bg-blue-500 border-blue-500" : "border-gray-600"
                  }`}>
                    {isSelected && <span className="text-[8px] text-white">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-200 truncate">{strategy.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{strategy.description}</div>
                  </div>
                  <div className="text-[10px] text-gray-500">置信度 {(strategy.confidence * 100).toFixed(0)}%</div>
                </button>
              );
            })}
          </div>
          {selectedStrategies.length > 0 && (
            <div className="text-[10px] text-gray-500">
              已选择 {selectedStrategies.length} 个策略
            </div>
          )}
        </div>
      )}

      {/* 步骤2：配置权重 */}
      {step === 2 && (
        <div className="space-y-2">
          {selectedStrategies.length === 0 ? (
            <div className="text-center text-gray-500 text-xs py-4">请先在第一步选择策略</div>
          ) : (
            <>
              <div className="flex gap-2">
                <button onClick={equalizeWeights} className="flex-1 px-2 py-1 text-[10px] bg-gray-800 text-gray-400 rounded hover:bg-gray-700">一键均分</button>
                <button onClick={distributeByConfidence} className="flex-1 px-2 py-1 text-[10px] bg-gray-800 text-gray-400 rounded hover:bg-gray-700">按置信度分配</button>
              </div>
              <div className={`text-[10px] ${totalWeight === 100 ? "text-green-400" : "text-red-400"}`}>
                权重总计：{totalWeight}% {totalWeight !== 100 && "（需等于100%）"}
              </div>
              <div className="space-y-2">
                {selectedStrategies.map(strategy => (
                  <div key={strategy.strategyId} className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-20 truncate">{strategy.strategyName}</span>
                    <input type="range" min="0" max="100" value={strategy.weight}
                      onChange={(e) => updateWeight(strategy.strategyId, Number(e.target.value))}
                      className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    <input type="number" min="0" max="100" value={strategy.weight}
                      onChange={(e) => updateWeight(strategy.strategyId, Number(e.target.value))}
                      className="w-12 px-1 py-0.5 bg-[#0a0e17] border border-gray-700 rounded text-[10px] text-gray-200 text-center" />
                    <span className="text-[10px] text-gray-500 w-6">%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 步骤3：交易阈值 */}
      {step === 3 && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">综合评分阈值</label>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="100" value={tradeThreshold}
                onChange={(e) => onThresholdChange?.(Number(e.target.value))}
                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
              <span className="text-xs text-blue-400 w-10 text-right">{tradeThreshold}分</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">综合评分达到此分数时自动执行交易</p>
          </div>

          {/* 策略模板管理 */}
          <div className="border-t border-gray-800 pt-2">
            <div className="text-[10px] text-gray-500 mb-1">策略模板</div>
            <div className="flex gap-1 mb-2">
              <button onClick={saveTemplate} className="px-2 py-1 text-[10px] bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30">保存当前配置</button>
              <button onClick={exportConfig} className="px-2 py-1 text-[10px] bg-gray-800 text-gray-400 rounded hover:bg-gray-700">导出</button>
              <button onClick={importConfig} className="px-2 py-1 text-[10px] bg-gray-800 text-gray-400 rounded hover:bg-gray-700">导入</button>
            </div>
            {templates.length > 0 && (
              <div className="space-y-1 max-h-[100px] overflow-y-auto">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                    <span className="text-[10px] text-gray-300">{t.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => loadTemplate(t)} className="text-[10px] text-blue-400 hover:text-blue-300">加载</button>
                      <button onClick={() => deleteTemplate(t.id)} className="text-[10px] text-red-400 hover:text-red-300">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 综合策略摘要 */}
          <div className="border-t border-gray-800 pt-2">
            <div className="text-[10px] text-gray-500 mb-1">当前策略摘要</div>
            <div className="bg-gray-800/30 rounded p-2 text-[10px] text-gray-400 space-y-0.5">
              <div>策略数量：{selectedStrategies.length} 个</div>
              <div>交易阈值：{tradeThreshold}分</div>
              <div>策略组合：{selectedStrategies.map(s => `${s.strategyName}(${s.weight}%)`).join(" + ") || "未选择"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
