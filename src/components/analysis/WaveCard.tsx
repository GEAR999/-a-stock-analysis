'use client';

import { useState, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { analyzeWaves } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';

interface WaveAnalysis {
  currentWave: string;
  waveDescription: string;
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
  waveStructure: {
    type: '推动浪' | '调整浪';
    current: string;
    progress: string;
  };
}

function generateWaveAnalysis(klineData: KLineData[]): WaveAnalysis {
  const waveResult = analyzeWaves(klineData);
  const { waves } = waveResult;
  
  let currentWave = '数据不足';
  let waveDescription = 'K 线数据不足以识别波浪结构';
  let direction: '上升' | '下降' | '震荡' = '震荡';
  let confidence: '高' | '中' | '低' = '低';
  let basis = '数据不足';
  let waveType: '推动浪' | '调整浪' = '推动浪';
  let currentWaveLabel = '未知';
  let progress = '0/5';
  
  if (waves.length > 0) {
    const lastWave = waves[waves.length - 1];
    const isImpulse = lastWave.type === 'impulse';
    waveType = isImpulse ? '推动浪' : '调整浪';
    currentWaveLabel = lastWave.label;
    progress = isImpulse ? `${waves.filter(w => w.type === 'impulse').length}/5` : `${waves.filter(w => w.type === 'corrective').length}/3`;
    
    if (isImpulse) {
      const impulseCount = waves.filter(w => w.type === 'impulse').length;
      if (impulseCount === 3) {
        currentWave = '推动浪第 3 浪';
        waveDescription = '当前处于 5 浪推动结构的第 3 浪（主升浪），这是推动浪中最强的一浪';
        direction = '上升';
        confidence = '高';
        basis = '第 3 浪特征明显：涨幅大于第 1 浪，成交量放大';
      } else if (impulseCount >= 5) {
        currentWave = '推动浪第 5 浪';
        waveDescription = '当前处于推动浪的最后一浪，上涨动能可能衰竭';
        direction = '上升';
        confidence = '中';
        basis = '第 5 浪末端，注意成交量背离';
      } else if (impulseCount === 1) {
        currentWave = '推动浪第 1 浪';
        waveDescription = '新的推动浪开始，第 1 浪通常涨幅较小';
        direction = '上升';
        confidence = '低';
        basis = '第 1 浪刚开始，需要后续确认';
      } else {
        currentWave = `推动浪第${impulseCount}浪`;
        waveDescription = `当前处于推动浪的第${impulseCount}浪`;
        direction = '上升';
        confidence = '中';
        basis = `推动浪进行中，进度${impulseCount}/5`;
      }
    } else {
      const correctiveCount = waves.filter(w => w.type === 'corrective').length;
      if (correctiveCount === 1) {
        currentWave = '调整浪第 A 浪';
        waveDescription = '当前处于 ABC 调整结构的 A 浪（下跌浪）';
        direction = '下降';
        confidence = '中';
        basis = 'A 浪下跌中，等待 B 浪反弹';
      } else if (correctiveCount >= 3) {
        currentWave = '调整浪第 C 浪';
        waveDescription = '当前处于 ABC 调整结构的 C 浪（最后一跌）';
        direction = '下降';
        confidence = '高';
        basis = 'C 浪末端，即将完成调整';
      } else {
        currentWave = `调整浪第${correctiveCount === 1 ? 'A' : correctiveCount === 2 ? 'B' : 'C'}浪`;
        waveDescription = `当前处于调整浪的第${correctiveCount}浪`;
        direction = '下降';
        confidence = '中';
        basis = `调整浪进行中，进度${correctiveCount}/3`;
      }
    }
  }
  
  const lastPrice = klineData.length > 0 ? klineData[klineData.length - 1].close : 0;
  const paths: WaveAnalysis['paths'] = [];
  
  if (direction === '上升') {
    paths.push({
      name: '乐观路径',
      probability: 45,
      condition: '当前浪继续延伸',
      target: `${(lastPrice * 1.08).toFixed(2)}-${(lastPrice * 1.12).toFixed(2)}`,
      timeframe: '8-12 个交易日',
      strategy: '持股待涨，关注浪型结束信号',
    });
    paths.push({
      name: '中性路径',
      probability: 35,
      condition: '当前浪即将结束，进入调整',
      target: `${(lastPrice * 0.95).toFixed(2)}-${(lastPrice * 0.98).toFixed(2)}`,
      timeframe: '3-5 个交易日后开始调整',
      strategy: '逐步减仓，等待调整结束再介入',
    });
    paths.push({
      name: '悲观路径',
      probability: 20,
      condition: '浪型计数错误',
      target: `${(lastPrice * 0.90).toFixed(2)}-${(lastPrice * 0.93).toFixed(2)}`,
      timeframe: '5-8 个交易日',
      strategy: '立即减仓，重新评估浪型',
    });
  } else if (direction === '下降') {
    paths.push({
      name: '乐观路径',
      probability: 35,
      condition: '调整即将结束，新推动浪开始',
      target: `${(lastPrice * 1.05).toFixed(2)}-${(lastPrice * 1.08).toFixed(2)}`,
      timeframe: '5-10 个交易日',
      strategy: '轻仓试多，止损设在调整低点下方',
    });
    paths.push({
      name: '中性路径',
      probability: 40,
      condition: '调整浪继续',
      target: `${(lastPrice * 0.95).toFixed(2)}-${(lastPrice * 0.98).toFixed(2)}`,
      timeframe: '5-8 个交易日',
      strategy: '观望为主，等待调整完成',
    });
    paths.push({
      name: '悲观路径',
      probability: 25,
      condition: '调整幅度超预期',
      target: `${(lastPrice * 0.88).toFixed(2)}-${(lastPrice * 0.92).toFixed(2)}`,
      timeframe: '8-12 个交易日',
      strategy: '空仓等待，不抄底',
    });
  } else {
    paths.push({
      name: '向上突破',
      probability: 35,
      condition: '突破前高',
      target: `${(lastPrice * 1.08).toFixed(2)}-${(lastPrice * 1.12).toFixed(2)}`,
      timeframe: '5-10 个交易日',
      strategy: '突破后跟进',
    });
    paths.push({
      name: '继续震荡',
      probability: 40,
      condition: '区间震荡',
      target: `${(lastPrice * 0.97).toFixed(2)}-${(lastPrice * 1.03).toFixed(2)}`,
      timeframe: '10-15 个交易日',
      strategy: '高抛低吸',
    });
    paths.push({
      name: '向下突破',
      probability: 25,
      condition: '跌破前低',
      target: `${(lastPrice * 0.92).toFixed(2)}-${(lastPrice * 0.95).toFixed(2)}`,
      timeframe: '5-8 个交易日',
      strategy: '止损离场',
    });
  }
  
  let advice = '';
  if (direction === '上升') {
    advice = '上升浪中，建议持股享受利润。关注浪型结束信号（成交量背离、涨幅放缓），及时在调整开始前减仓';
  } else if (direction === '下降') {
    advice = '调整浪中，建议观望为主。等待调整完成信号（ABC 结构完成、成交量萎缩），再考虑介入';
  } else {
    advice = '浪型不明确，建议观望。等待清晰的波浪结构形成后再操作';
  }
  
  const risks: string[] = [];
  if (waves.length === 0) {
    risks.push('数据不足，无法识别波浪结构');
  } else {
    risks.push('波浪理论主观性强，不同分析者可能有不同计数');
    risks.push('浪型可能随时重新计数，需动态调整');
    if (direction === '上升' && waves.filter(w => w.type === 'impulse').length >= 4) {
      risks.push('推动浪接近尾声，警惕调整风险');
    }
  }
  
  return {
    currentWave,
    waveDescription,
    trendAssessment: { direction, confidence, basis },
    paths,
    advice,
    risks,
    waveStructure: {
      type: waveType,
      current: currentWaveLabel,
      progress,
    },
  };
}

interface WaveCardProps {
  visible: boolean;
  klineData?: KLineData[];
  onConclusion?: (conclusion: { name: string; direction: '上升' | '下降' | '震荡'; confidence: '高' | '中' | '低'; advice: string } | null) => void;
}

export function WaveCard({ visible, klineData = [], onConclusion }: WaveCardProps) {
  const [expanded, setExpanded] = useState(true);
  const analysis = useMemo(() => generateWaveAnalysis(klineData), [klineData]);

  // 将真实结论传递给父组件
  useMemo(() => {
    if (onConclusion) {
      onConclusion({
        name: '波浪理论',
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
    <div className="rounded border border-blue-500/30 bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border-b border-blue-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-blue-300">波浪理论分析</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-blue-400/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px] bg-[var(--bg-primary)] border-blue-500/30">
                <p className="text-xs text-[var(--text-primary)]">基于艾略特波浪理论，识别推动浪 (1-2-3-4-5) 和调整浪 (A-B-C) 结构</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-400/60 hover:text-blue-300"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-3 p-2 rounded bg-blue-500/5 border border-blue-500/20">
            <div className="text-center">
              <div className="text-xs text-[var(--text-secondary)]">浪型</div>
              <div className="text-sm text-blue-300 font-medium">{analysis.waveStructure.type}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[var(--text-secondary)]">当前</div>
              <div className="text-sm text-blue-200 font-bold">{analysis.waveStructure.current}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[var(--text-secondary)]">进度</div>
              <div className="text-sm text-blue-300">{analysis.waveStructure.progress}</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">当前位置</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-[var(--text-secondary)] cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[300px] bg-[var(--bg-primary)] border-blue-500/30">
                    <p className="text-xs text-[var(--text-primary)]">{analysis.waveDescription}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-sm text-blue-200 font-medium">{analysis.currentWave}</div>
          </div>

          <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
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

          <div className="space-y-2">
            <span className="text-xs text-[var(--text-secondary)]">浪型推演</span>
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
                    <TooltipContent side="right" className="max-w-[280px] bg-[var(--bg-primary)] border-blue-500/30">
                      <div className="space-y-1.5">
                        <p className="text-xs text-[var(--text-primary)]"><span className="text-[var(--text-secondary)]">条件:</span> {path.condition}</p>
                        <p className="text-xs text-[var(--text-primary)]"><span className="text-[var(--text-secondary)]">目标:</span> {path.target}</p>
                        <p className="text-xs text-[var(--text-primary)]"><span className="text-[var(--text-secondary)]">时间:</span> {path.timeframe}</p>
                        <p className="text-xs text-blue-300"><span className="text-[var(--text-secondary)]">策略:</span> {path.strategy}</p>
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
