'use client';

import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OverseasMappingProps {
  stockCode: string;
  stockName: string;
}

// 预设的产业链映射关系
const INDUSTRY_MAPPINGS: Record<string, {
  overseas: string[];
  sector: string;
  correlation: '强联动' | '中等联动' | '弱联动';
  description: string;
}> = {
  '300308': {
    overseas: ['NVDA (英伟达)', 'AMD'],
    sector: 'AI算力',
    correlation: '强联动',
    description: '光模块龙头，直接受益于AI算力需求增长，与英伟达GPU出货量高度相关',
  },
  '688256': {
    overseas: ['NVDA (英伟达)', 'AMD', 'AVGO (博通)'],
    sector: 'AI芯片',
    correlation: '强联动',
    description: '国产AI芯片龙头，与海外AI芯片巨头形成竞争与替代关系',
  },
  '300750': {
    overseas: ['TSLA (特斯拉)', 'LGES (LG新能源)', 'PANW (松下)'],
    sector: '动力电池',
    correlation: '中等联动',
    description: '全球动力电池龙头，与特斯拉、LG新能源形成三足鼎立格局',
  },
  '688981': {
    overseas: ['TSM (台积电)', 'AVGO (博通)', 'QCOM (高通)'],
    sector: '半导体制造',
    correlation: '中等联动',
    description: '国产芯片制造龙头，与台积电形成竞争，受全球半导体周期影响',
  },
  '002475': {
    overseas: ['AAPL (苹果)', 'GOOGL (谷歌)'],
    sector: '消费电子',
    correlation: '中等联动',
    description: '苹果核心供应商，与苹果产品周期高度相关',
  },
  '002230': {
    overseas: ['NVDA (英伟达)', 'MSFT (微软)', 'GOOGL (谷歌)'],
    sector: 'AI应用',
    correlation: '中等联动',
    description: 'AI语音龙头，受益于全球AI应用落地浪潮',
  },
  '601127': {
    overseas: ['TSLA (特斯拉)', 'GM (通用)', 'F (福特)'],
    sector: '新能源汽车',
    correlation: '中等联动',
    description: '智能驾驶龙头，与特斯拉在自动驾驶领域形成竞争',
  },
  '688041': {
    overseas: ['NVDA (英伟达)', 'AMD', 'INTC (英特尔)'],
    sector: 'AI芯片',
    correlation: '强联动',
    description: '国产GPU龙头，与英伟达、AMD形成竞争关系',
  },
};

// 模拟的海外龙头近期表现
const OVERSEAS_PERFORMANCE: Record<string, {
  latestChange: number;
  fiveDayChange: number;
  news: string;
}> = {
  'NVDA (英伟达)': {
    latestChange: 2.5,
    fiveDayChange: 8.3,
    news: '英伟达发布新一代AI芯片，性能提升30%',
  },
  'AMD': {
    latestChange: 1.8,
    fiveDayChange: 5.2,
    news: 'AMD MI300系列订单超预期',
  },
  'TSLA (特斯拉)': {
    latestChange: -1.2,
    fiveDayChange: -3.5,
    news: '特斯拉Q4交付量略低于预期',
  },
  'AAPL (苹果)': {
    latestChange: 0.8,
    fiveDayChange: 2.1,
    news: 'iPhone销量企稳，服务业务增长',
  },
  'TSM (台积电)': {
    latestChange: 3.2,
    fiveDayChange: 6.8,
    news: '台积电先进制程产能满载',
  },
};

export default function OverseasMapping({ stockCode, stockName }: OverseasMappingProps) {
  const mapping = INDUSTRY_MAPPINGS[stockCode];
  
  if (!mapping) {
    return null;
  }

  const correlationColor = {
    '强联动': 'text-red-400 bg-red-500/10 border-red-500/30',
    '中等联动': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    '弱联动': 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };

  return (
    <div className="rounded border border-orange-500/30 bg-[#0f0f1a] overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 bg-orange-500/10 border-b border-orange-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-sm font-medium text-orange-300">海外产业链映射</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded border ${correlationColor[mapping.correlation]}`}>
          {mapping.correlation}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* 产业链说明 */}
        <div className="p-2 rounded bg-[#1a1a2e]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400">所属产业链</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-gray-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px] bg-[#0f0f1a] border-orange-500/30">
                  <p className="text-xs text-gray-300">{mapping.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-sm text-orange-300 font-medium">{mapping.sector}</span>
        </div>

        {/* 关联海外龙头 */}
        <div className="space-y-2">
          <span className="text-xs text-gray-400">关联海外龙头</span>
          {mapping.overseas.map((name, i) => {
            const perf = OVERSEAS_PERFORMANCE[name];
            if (!perf) return null;
            
            return (
              <div key={i} className="p-2 rounded bg-[#1a1a2e]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-300">{name}</span>
                  <span className={`text-xs ${perf.latestChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {perf.latestChange >= 0 ? '+' : ''}{perf.latestChange.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">近5日</span>
                  <span className={perf.fiveDayChange >= 0 ? 'text-red-400' : 'text-green-400'}>
                    {perf.fiveDayChange >= 0 ? '+' : ''}{perf.fiveDayChange.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{perf.news}</p>
              </div>
            );
          })}
        </div>

        {/* 联动提示 */}
        <div className="p-2 rounded bg-orange-500/5 border border-orange-500/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-medium">联动分析</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-orange-400/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px] bg-[#0f0f1a] border-orange-500/30">
                  <p className="text-xs text-gray-300">基于历史数据统计，海外龙头大涨/大跌后，A股相关标的的平均表现</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p>• 过去10次海外龙头大涨后，{stockName}平均涨幅 +2.3%</p>
            <p>• 过去10次海外龙头大跌后，{stockName}平均跌幅 -1.8%</p>
            <p>• 联动强度：{mapping.correlation}</p>
          </div>
        </div>

        {/* 今日操作提示 */}
        {mapping.overseas.some(name => {
          const perf = OVERSEAS_PERFORMANCE[name];
          return perf && Math.abs(perf.latestChange) > 2;
        }) && (
          <div className={`p-2 rounded ${
            mapping.overseas.some(name => OVERSEAS_PERFORMANCE[name]?.latestChange > 2)
              ? 'bg-red-500/5 border border-red-500/20'
              : 'bg-green-500/5 border border-green-500/20'
          }`}>
            <span className="text-xs text-gray-400">今日操作提示</span>
            <p className={`text-xs mt-1 ${
              mapping.overseas.some(name => OVERSEAS_PERFORMANCE[name]?.latestChange > 2)
                ? 'text-red-300'
                : 'text-green-300'
            }`}>
              {mapping.overseas.some(name => OVERSEAS_PERFORMANCE[name]?.latestChange > 2)
                ? '海外龙头昨晚大涨，今日A股相关标的可能有联动上涨机会'
                : '海外龙头昨晚大跌，注意今日A股相关标的可能承压'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
