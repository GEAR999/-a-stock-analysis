'use client';

import { useState, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { analyzeChanlun } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';

// 缠论分析数据类型
interface ChanlunAnalysis {
  currentStage: string;
  stageDescription: string;
  trendAssessment: {
    direction: '上升' | '下降' | '震荡';
    confidence: '高' | '中' | '低';
    basis: string;
  };
  paths: Array<{
    name: string;
    probability: number;
    condition: string;
    target: string;
    timeframe: string;
    strategy: string;
  }>;
  advice: string;
  risks: string[];
  signals: Array<{
    type: 'buy' | 'sell' | 'neutral';
    name: string;
    description: string;
    basis: string;
  }>;
}

// 基于真实 K 线数据生成缠论分析
function generateChanlunAnalysis(klineData: KLineData[]): ChanlunAnalysis {
  const chanlunResult = analyzeChanlun(klineData);
  
  const { strokes, centers, buySignals, sellSignals } = chanlunResult;
  
  let direction: '上升' | '下降' | '震荡' = '震荡';
  let confidence: '高' | '中' | '低' = '低';
  let basis = '数据不足';
  let currentStage = '数据加载中';
  let stageDescription = '';
  
  if (strokes.length > 0) {
    const lastStroke = strokes[strokes.length - 1];
    direction = lastStroke.direction === 'up' ? '上升' : '下降';
    confidence = strokes.length >= 5 ? '高' : strokes.length >= 3 ? '中' : '低';
    basis = `${direction}笔延续中，共识别${strokes.length}笔`;
    
    if (centers.length > 0) {
      const lastCenter = centers[centers.length - 1];
      const lastPrice = klineData[klineData.length - 1].close;
      const aboveCenter = lastPrice > lastCenter.high;
      
      if (aboveCenter && lastStroke.direction === 'up') {
        currentStage = '中枢上方上升笔';
        stageDescription = `价格在中枢[${lastCenter.low.toFixed(2)}-${lastCenter.high.toFixed(2)}]上方运行，上升笔延续`;
      } else if (!aboveCenter && lastStroke.direction === 'down') {
        currentStage = '中枢下方下降笔';
        stageDescription = `价格在中枢[${lastCenter.low.toFixed(2)}-${lastCenter.high.toFixed(2)}]下方运行，下降笔延续`;
      } else {
        currentStage = '中枢震荡';
        stageDescription = `价格在中枢[${lastCenter.low.toFixed(2)}-${lastCenter.high.toFixed(2)}]内震荡`;
      }
    } else {
      currentStage = `${direction}笔形成中`;
      stageDescription = `尚未形成中枢，当前为${direction}笔`;
    }
  }
  
  const lastPrice = klineData.length > 0 ? klineData[klineData.length - 1].close : 0;
  const paths: ChanlunAnalysis['paths'] = [];
  
  if (direction === '上升') {
    paths.push({
      name: '乐观路径',
      probability: 40,
      condition: '上升笔延续，突破前高',
      target: `${(lastPrice * 1.08).toFixed(2)}-${(lastPrice * 1.12).toFixed(2)}`,
      timeframe: '5-10 个交易日',
      strategy: '持股待涨，突破后加仓',
    });
    paths.push({
      name: '中性路径',
      probability: 40,
      condition: '上升笔结束，进入中枢震荡',
      target: `${(lastPrice * 0.97).toFixed(2)}-${(lastPrice * 1.03).toFixed(2)}`,
      timeframe: '10-15 个交易日',
      strategy: '高抛低吸，等待方向选择',
    });
    paths.push({
      name: '悲观路径',
      probability: 20,
      condition: '出现顶分型，下降笔开始',
      target: `${(lastPrice * 0.92).toFixed(2)}-${(lastPrice * 0.95).toFixed(2)}`,
      timeframe: '5-8 个交易日',
      strategy: '减仓或离场，等待新的买点',
    });
  } else if (direction === '下降') {
    paths.push({
      name: '乐观路径',
      probability: 30,
      condition: '出现底分型，上升笔开始',
      target: `${(lastPrice * 1.05).toFixed(2)}-${(lastPrice * 1.08).toFixed(2)}`,
      timeframe: '5-10 个交易日',
      strategy: '轻仓试多，止损设在底分型下方',
    });
    paths.push({
      name: '中性路径',
      probability: 40,
      condition: '下降笔结束，进入中枢震荡',
      target: `${(lastPrice * 0.97).toFixed(2)}-${(lastPrice * 1.03).toFixed(2)}`,
      timeframe: '10-15 个交易日',
      strategy: '观望为主，等待明确信号',
    });
    paths.push({
      name: '悲观路径',
      probability: 30,
      condition: '下降笔延续，跌破前低',
      target: `${(lastPrice * 0.92).toFixed(2)}-${(lastPrice * 0.95).toFixed(2)}`,
      timeframe: '5-8 个交易日',
      strategy: '空仓等待，不抄底',
    });
  } else {
    paths.push({
      name: '向上突破',
      probability: 35,
      condition: '突破中枢上沿',
      target: `${(lastPrice * 1.08).toFixed(2)}-${(lastPrice * 1.12).toFixed(2)}`,
      timeframe: '5-10 个交易日',
      strategy: '突破后跟进',
    });
    paths.push({
      name: '继续震荡',
      probability: 40,
      condition: '在中枢内继续震荡',
      target: `${(lastPrice * 0.97).toFixed(2)}-${(lastPrice * 1.03).toFixed(2)}`,
      timeframe: '10-15 个交易日',
      strategy: '高抛低吸',
    });
    paths.push({
      name: '向下突破',
      probability: 25,
      condition: '跌破中枢下沿',
      target: `${(lastPrice * 0.92).toFixed(2)}-${(lastPrice * 0.95).toFixed(2)}`,
      timeframe: '5-8 个交易日',
      strategy: '止损离场',
    });
  }
  
  let advice = '';
  if (direction === '上升') {
    advice = buySignals.length > 0 
      ? `出现${buySignals[buySignals.length - 1].type}类买点，可考虑介入。上升笔延续中，持股为主`
      : '上升笔延续中，建议持股观察。若出现顶分型应减仓';
  } else if (direction === '下降') {
    advice = sellSignals.length > 0
      ? `出现${sellSignals[sellSignals.length - 1].type}类卖点，建议减仓。下降笔延续中，观望为主`
      : '下降笔延续中，建议观望。若出现底分型可轻仓试多';
  } else {
    advice = '中枢震荡中，建议高抛低吸。突破中枢上沿可跟进，跌破中枢下沿应止损';
  }
  
  const risks: string[] = [];
  if (strokes.length > 0) {
    const lastStroke = strokes[strokes.length - 1];
    const strokeLength = Math.abs(lastStroke.end - lastStroke.start);
    if (strokeLength >= 8) {
      risks.push(`${direction}笔已延续${strokeLength}根 K 线，注意${direction === '上升' ? '顶' : '底'}分型出现`);
    }
  }
  if (centers.length > 0) {
    const lastCenter = centers[centers.length - 1];
    risks.push(`中枢区间 [${lastCenter.low.toFixed(2)}-${lastCenter.high.toFixed(2)}]，关注突破方向`);
  }
  if (buySignals.length === 0 && sellSignals.length === 0) {
    risks.push('暂无明确买卖信号，等待分型确认');
  }
  if (risks.length === 0) {
    risks.push('数据不足，分析仅供参考');
  }
  
  const signals: ChanlunAnalysis['signals'] = [];
  if (centers.length > 0) {
    signals.push({
      type: 'neutral',
      name: '中枢震荡',
      description: '当前处于中枢区间内震荡',
      basis: `中枢区间 [${centers[centers.length - 1].low.toFixed(2)}-${centers[centers.length - 1].high.toFixed(2)}]`,
    });
  }
  if (strokes.length > 0) {
    const lastStroke = strokes[strokes.length - 1];
    signals.push({
      type: lastStroke.direction === 'up' ? 'buy' : 'sell',
      name: `${lastStroke.direction === 'up' ? '上升' : '下降'}笔延续`,
      description: `当前笔方向${lastStroke.direction === 'up' ? '向上' : '向下'}，未出现${lastStroke.direction === 'up' ? '顶' : '底'}分型`,
      basis: `共识别${strokes.length}笔`,
    });
  }
  buySignals.forEach((signal, idx) => {
    const confidenceLevel = signal.confidence >= 0.8 ? '高' : signal.confidence >= 0.6 ? '中' : '低';
    signals.push({
      type: 'buy',
      name: `${signal.type}类买点`,
      description: `第${idx + 1}个买点信号（置信度：${confidenceLevel}）`,
      basis: `价格${signal.price.toFixed(2)}，评分${(signal.confidence * 100).toFixed(0)}%`,
    });
  });
  sellSignals.forEach((signal, idx) => {
    const confidenceLevel = signal.confidence >= 0.8 ? '高' : signal.confidence >= 0.6 ? '中' : '低';
    signals.push({
      type: 'sell',
      name: `${signal.type}类卖点`,
      description: `第${idx + 1}个卖点信号（置信度：${confidenceLevel}）`,
      basis: `价格${signal.price.toFixed(2)}，评分${(signal.confidence * 100).toFixed(0)}%`,
    });
  });
  
  if (signals.length === 0) {
    signals.push({
      type: 'neutral',
      name: '数据不足',
      description: 'K 线数据不足以生成缠论分析',
      basis: '需要至少 10 根 K 线',
    });
  }
  
  return {
    currentStage,
    stageDescription,
    trendAssessment: { direction, confidence, basis },
    paths,
    advice,
    risks,
    signals,
  };
}

interface ChanlunCardProps {
  visible: boolean;
  klineData?: KLineData[];
  onConclusion?: (conclusion: { name: string; direction: '上升' | '下降' | '震荡'; confidence: '高' | '中' | '低'; advice: string } | null) => void;
}

export function ChanlunCard({ visible, klineData = [], onConclusion }: ChanlunCardProps) {
  const [expanded, setExpanded] = useState(true);
  const analysis = useMemo(() => generateChanlunAnalysis(klineData), [klineData]);

  // 将真实结论传递给父组件
  useMemo(() => {
    if (onConclusion) {
      onConclusion({
        name: '缠论',
        direction: analysis.trendAssessment.direction,
        confidence: analysis.trendAssessment.confidence,
        advice: analysis.advice,
      });
    }
  }, [analysis.trendAssessment.direction, analysis.trendAssessment.confidence, analysis.advice, onConclusion]);

  if (!visible) return null;

  const directionColor = analysis.trendAssessment.direction === '上升' ? 'text-[var(--accent-red)]' :
    analysis.trendAssessment.direction === '下降' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-yellow)]';

  const confidenceColor = analysis.trendAssessment.confidence === '高' ? 'text-[var(--accent-green)]' :
    analysis.trendAssessment.confidence === '中' ? 'text-[var(--accent-yellow)]' : 'text-[var(--accent-red)]';

  return (
    <div className="rounded border border-purple-500/30 bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-purple-500/10 border-b border-purple-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-sm font-medium text-purple-300">缠论分析</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-purple-400/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px] bg-[var(--bg-primary)] border-purple-500/30">
                <p className="text-xs text-[var(--text-primary)]">基于缠论理论，自动识别笔、线段、中枢，判断当前走势阶段</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-purple-400/60 hover:text-purple-300"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">当前阶段</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-[var(--text-secondary)] cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[300px] bg-[var(--bg-primary)] border-purple-500/30">
                    <p className="text-xs text-[var(--text-primary)]">{analysis.stageDescription}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-sm text-purple-200 font-medium">{analysis.currentStage}</div>
          </div>

          <div className="p-2 rounded bg-purple-500/5 border border-purple-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text-secondary)]">走势研判</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${directionColor}`}>
                  {analysis.trendAssessment.direction}趋势
                </span>
                <span className={`text-xs ${confidenceColor}`}>
                  ({analysis.trendAssessment.confidence}置信)
                </span>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{analysis.trendAssessment.basis}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">关键信号</span>
            {analysis.signals.map((signal, i) => (
              <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-[var(--bg-panel)]">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  signal.type === 'buy' ? 'bg-red-500/20 text-[var(--accent-red)]' :
                  signal.type === 'sell' ? 'bg-green-500/20 text-[var(--accent-green)]' :
                  'bg-yellow-500/20 text-[var(--accent-yellow)]'
                }`}>
                  {signal.type === 'buy' ? '多' : signal.type === 'sell' ? '空' : '中'}
                </span>
                <div className="flex-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-[var(--text-primary)] cursor-help border-b border-dashed border-[var(--border-default)]">
                          {signal.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[300px] bg-[var(--bg-primary)] border-purple-500/30">
                        <p className="text-xs text-[var(--text-primary)] mb-1">{signal.description}</p>
                        <p className="text-xs text-purple-300">依据：{signal.basis}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <span className="text-xs text-[var(--text-secondary)]">走势推演</span>
            <div className="grid grid-cols-3 gap-1.5">
              {analysis.paths.map((path, i) => (
                <TooltipProvider key={i}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`p-2 rounded text-center cursor-help ${
                        i === 0 ? 'bg-red-500/10 border border-red-500/20' :
                        i === 1 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                        'bg-green-500/10 border border-green-500/20'
                      }`}>
                        <div className="text-xs font-medium text-[var(--text-primary)]">{path.name}</div>
                        <div className="text-xs font-medium text-[var(--text-secondary)]">{path.probability}%</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[280px] bg-[var(--bg-primary)] border-purple-500/30">
                      <div className="space-y-1.5">
                        <p className="text-xs text-[var(--text-primary)]"><span className="text-[var(--text-secondary)]">条件:</span> {path.condition}</p>
                        <p className="text-xs text-[var(--text-primary)]"><span className="text-[var(--text-secondary)]">目标:</span> {path.target}</p>
                        <p className="text-xs text-[var(--text-primary)]"><span className="text-[var(--text-secondary)]">时间:</span> {path.timeframe}</p>
                        <p className="text-xs text-purple-300"><span className="text-[var(--text-secondary)]">策略:</span> {path.strategy}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
            <span className="text-xs text-[var(--text-secondary)]">操作建议</span>
            <p className="text-xs text-blue-200 mt-1">{analysis.advice}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-[var(--accent-red)]">风险提示</span>
            {analysis.risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-red-300/80">
                <span className="text-[var(--accent-red)] mt-0.5">!</span>
                <span>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
