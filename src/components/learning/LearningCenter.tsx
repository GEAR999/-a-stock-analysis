'use client';

import { useState } from 'react';

type LearningTab = 'chanlun' | 'wave' | 'indicator' | 'pattern' | 'position' | 'cases' | 'compare' | 'review';

interface Lesson {
  id: string;
  title: string;
  content: string;
  keyPoints: string[];
  illustrations?: { type: string; caption: string; ascii?: string }[];
}

// 缠论课程
const chanlunLessons: Lesson[] = [
  {
    id: 'intro',
    title: '什么是缠论',
    content: '缠论是由"缠中说禅"创立的技术分析理论，核心是通过严格的数学定义来识别走势的结构和转折点。缠论认为所有走势都可以被分解为不同级别的走势类型，并通过分型、笔、线段、中枢等概念构建了一套完整的分析体系。',
    keyPoints: ['走势的自相似性', '级别的递归', '买卖点的严格定义', '不预测只跟随'],
  },
  {
    id: 'fenxing',
    title: '分型识别',
    content: '分型是缠论的基础，由相邻三根K线构成。顶分型：中间K线的高点是三根中最高的，低点也是最高的。底分型：中间K线的低点是三根中最低的，高点也是最低的。',
    keyPoints: ['顶分型：中间K线高点最高，低点也最高', '底分型：中间K线低点最低，高点也最低', '分型是笔的端点', '分型需要确认（包含处理后）'],
    illustrations: [
      { type: 'diagram', caption: '顶分型', ascii: '  /\\  \n /  \\ \n/    \\' },
      { type: 'diagram', caption: '底分型', ascii: '\\    /\n \\  / \n  \\/  ' },
    ],
  },
  {
    id: 'bi',
    title: '笔的划分',
    content: '笔是连接相邻顶分型和底分型的最小走势单位。从顶分型到底分型为一笔向下，从底分型到顶分型为一笔向上。笔必须至少包含5根K线（包含处理后）。',
    keyPoints: ['顶分型到底分型为一笔向下', '底分型到顶分型为一笔向上', '笔必须至少包含5根K线', '顶底分型之间至少有1根独立K线'],
  },
  {
    id: 'xianduan',
    title: '线段的划分',
    content: '线段至少由3笔构成，是比笔更大级别的走势单位。线段的划分需要用到特征序列的概念，当特征序列出现分型时，线段可能结束。',
    keyPoints: ['线段至少由3笔构成', '特征序列判断线段结束', '线段破坏的两种情况', '线段是中枢构建的基础'],
  },
  {
    id: 'zhongshu',
    title: '中枢的构建',
    content: '中枢是至少3个连续次级别走势类型的重叠区域。中枢有区间（ZG-ZD），是判断走势类型的核心依据。',
    keyPoints: ['至少3个次级别走势重叠', '中枢区间：ZG（中枢高点）到ZD（中枢低点）', '中枢的级别可以升级', '中枢是判断趋势/盘整的关键'],
  },
  {
    id: 'zoushi',
    title: '走势类型',
    content: '走势分为趋势和盘整两大类。趋势：至少包含2个同向中枢（上涨趋势中枢上移，下跌趋势中枢下移）。盘整：只包含1个中枢。',
    keyPoints: ['趋势：至少2个同向中枢', '盘整：只包含1个中枢', '走势必完美：任何走势都会完成', '背驰是走势结束的信号'],
  },
  {
    id: 'maiyidian',
    title: '买卖点',
    content: '缠论定义了3类买卖点。一买：趋势背驰后的转折点（最危险但利润最大）。二买：一买后的回调不破前低（相对安全）。三买：中枢上方回调不入中枢（最安全）。',
    keyPoints: ['一买：趋势背驰转折点', '二买：回调不破前低', '三买：回调不入中枢', '卖点与买点相反'],
  },
];

// 波浪理论课程
const waveLessons: Lesson[] = [
  {
    id: 'intro',
    title: '艾略特波浪理论',
    content: '波浪理论由拉尔夫·艾略特创立，认为市场走势遵循一定的形态模式，最基本的是8浪循环：5浪推动+3浪调整。波浪理论结合了群体心理学，每一浪都反映了不同的市场情绪。',
    keyPoints: ['5浪推动 + 3浪调整', '波浪的层级关系', '市场情绪的周期性', '斐波那契数列的应用'],
  },
  {
    id: 'basic_pattern',
    title: '8浪循环模型',
    content: '一个完整的波浪循环包含8浪：推动浪（1-2-3-4-5）沿主趋势方向，调整浪（A-B-C）逆主趋势方向。推动浪中1、3、5浪向上，2、4浪回调。',
    keyPoints: ['推动浪方向与主趋势一致', '调整浪方向与主趋势相反', '一个循环结束后开始新的循环', '波浪可以嵌套（大浪套小浪）'],
  },
  {
    id: 'three_rules',
    title: '波浪3铁律',
    content: '波浪理论有3个不可违反的铁律，违反则意味着浪型划分错误。',
    keyPoints: [
      '铁律1：第2浪不能跌破第1浪起点',
      '铁律2：第3浪不是最短的推动浪（通常最长）',
      '铁律3：第4浪不能进入第1浪的价格区域',
    ],
  },
  {
    id: 'wave_characteristics',
    title: '各浪特征',
    content: '每一浪都有其独特的市场特征和成交量表现，识别这些特征有助于判断当前处于哪一浪。',
    keyPoints: [
      '第1浪：底部启动，多数人未察觉，成交量温和',
      '第2浪：深度回调（常回撤61.8%），测试信心',
      '第3浪：主升浪，最强最长，成交量最大',
      '第4浪：调整浪，通常横向整理，幅度较浅',
      '第5浪：最后冲刺，情绪亢奋，可能出现背离',
    ],
  },
  {
    id: 'fibonacci',
    title: '斐波那契回撤',
    content: '波浪理论常用斐波那契比率来预测回调和目标位。常用比率：23.6%、38.2%、50%、61.8%、78.6%。',
    keyPoints: [
      '第2浪常回撤第1浪的61.8%或50%',
      '第3浪目标常是第1浪的1.618倍',
      '第4浪常回撤第3浪的38.2%',
      '第5浪目标常等于第1浪或为第1-3浪的0.618',
    ],
  },
];

// 技术指标课程
const indicatorLessons: Lesson[] = [
  {
    id: 'macd',
    title: 'MACD（指数平滑异同移动平均线）',
    content: 'MACD是最常用的趋势指标，由DIF线、DEA线和MACD柱组成。用于判断趋势方向、买卖信号和背离。',
    keyPoints: [
      '金叉（DIF上穿DEA）：买入信号',
      '死叉（DIF下穿DEA）：卖出信号',
      '零轴以上金叉更强，零轴以下死叉更弱',
      '顶背离：股价新高但MACD未新高，见顶信号',
      '底背离：股价新低但MACD未新低，见底信号',
    ],
  },
  {
    id: 'kdj',
    title: 'KDJ（随机指标）',
    content: 'KDJ是震荡指标，用于判断超买超卖状态。K值、D值在0-100之间波动，J值可以超出这个范围。',
    keyPoints: [
      'K>80为超买区，K<20为超卖区',
      'K线上穿D线为金叉买入信号',
      'K线下穿D线为死叉卖出信号',
      'J值>100为极度超买，J值<0为极度超卖',
      '适合震荡行情，趋势行情易钝化',
    ],
  },
  {
    id: 'rsi',
    title: 'RSI（相对强弱指标）',
    content: 'RSI通过比较一定时期内的平均涨幅和平均跌幅来衡量买卖力量对比。常用周期为6日、12日、24日。',
    keyPoints: [
      'RSI>70为超买，RSI<30为超卖',
      'RSI在50以上为多头市场',
      'RSI在50以下为空头市场',
      '背离信号：股价新高但RSI未新高为顶背离',
      '不同周期的RSI可以交叉使用',
    ],
  },
  {
    id: 'boll',
    title: '布林带（BOLL）',
    content: '布林带由中轨（MA20）、上轨（中轨+2倍标准差）和下轨（中轨-2倍标准差）组成。用于判断价格波动范围和突破信号。',
    keyPoints: [
      '价格触及上轨可能回调',
      '价格触及下轨可能反弹',
      '布林带收窄预示即将变盘',
      '布林带扩大表示趋势加速',
      '中轨是多空分界线',
    ],
  },
  {
    id: 'ma',
    title: '均线系统（MA）',
    content: '均线是最基础的技术指标，代表一定时期内的平均成本。常用周期：5日、10日、20日、60日、120日、250日。',
    keyPoints: [
      '多头排列：短期均线在长期均线上方，看涨',
      '空头排列：短期均线在长期均线下方，看跌',
      '金叉：短期均线上穿长期均线',
      '死叉：短期均线下穿长期均线',
      '均线有支撑和压力作用',
    ],
  },
];

// K线形态课程
const patternLessons: Lesson[] = [
  {
    id: 'single_candle',
    title: '单K线形态',
    content: '单根K线可以反映当日多空力量的对比结果，是技术分析的基础。',
    keyPoints: [
      '大阳线：强烈看涨信号，买方完全控盘',
      '大阴线：强烈看跌信号，卖方完全控盘',
      '十字星：多空平衡，可能变盘',
      '锤子线：底部反转信号',
      '吊颈线：顶部反转信号',
      '射击之星：顶部反转信号',
    ],
  },
  {
    id: 'double_candle',
    title: '双K线组合',
    content: '两根K线的组合可以提供更可靠的反转或延续信号。',
    keyPoints: [
      '看涨吞没：阳线完全包住前一根阴线，底部反转',
      '看跌吞没：阴线完全包住前一根阳线，顶部反转',
      '乌云盖顶：阳线后高开低走的阴线',
      '刺透形态：阴线后低开高走的阳线',
      '平头顶部/底部：两根K线高点/低点相同',
    ],
  },
  {
    id: 'triple_candle',
    title: '三K线组合',
    content: '三根K线的组合形态通常比单根或双根更可靠。',
    keyPoints: [
      '早晨之星：底部反转，阴线+十字星+阳线',
      '黄昏之星：顶部反转，阳线+十字星+阴线',
      '三只乌鸦：连续三根阴线，强烈看跌',
      '红三兵：连续三根阳线，强烈看涨',
      '三角形态：整理后突破',
    ],
  },
];

// 仓位管理课程
const positionLessons: Lesson[] = [
  {
    id: 'basic_principle',
    title: '仓位管理基本原则',
    content: '仓位管理是风险控制的核心，合理的仓位配置可以在控制风险的同时获取收益。',
    keyPoints: [
      '永远不要满仓操作',
      '单只股票仓位不超过30%',
      '根据市场热度调整总仓位',
      '牛市可以重仓，熊市必须轻仓',
      '预留现金应对突发机会',
    ],
  },
  {
    id: 'pyramid',
    title: '金字塔建仓法',
    content: '金字塔建仓是一种分批买入的策略，越跌越买，每次买入金额递减。',
    keyPoints: [
      '首次建仓30%，下跌后加仓20%，再跌加仓10%',
      '降低成本，摊薄风险',
      '适合震荡市和底部区域',
      '需要足够的耐心和资金',
      '设置止损位，防止深套',
    ],
  },
  {
    id: 'stop_loss',
    title: '止损策略',
    content: '止损是保护本金的重要手段，没有止损的交易是危险的。',
    keyPoints: [
      '固定比例止损：如亏损8%无条件止损',
      '技术止损：跌破关键支撑位止损',
      '时间止损：持仓超过预期时间未达目标',
      '移动止损：随着盈利提高止损位',
      '止损后不要急于回补',
    ],
  },
  {
    id: 'take_profit',
    title: '止盈策略',
    content: '会买的是徒弟，会卖的是师傅。合理的止盈策略可以锁定利润。',
    keyPoints: [
      '目标价止盈：达到预设目标价卖出',
      '分批止盈：涨到目标先卖一半',
      '移动止盈：随着上涨提高止盈位',
      '技术止盈：出现顶部信号时卖出',
      '不要贪心，落袋为安',
    ],
  },
];

// 经典案例
const classicCases = [
  {
    id: 'chanlun_1buy',
    theory: '缠论',
    title: '缠论一买经典案例',
    description: '某股票经过长期下跌，形成下跌趋势（两个下跌中枢）。最后一个中枢下方出现背驰信号（MACD面积缩小），构成一买机会。',
    keyPoints: ['识别下跌趋势（两个中枢）', '确认背驰信号', '一买位置介入', '止损设在前低下方'],
  },
  {
    id: 'wave_3wave',
    theory: '波浪理论',
    title: '第3浪主升浪案例',
    description: '某股票完成第1浪上涨和第2浪回调后，进入第3浪主升浪。第3浪通常是最长最强的一浪，成交量最大。',
    keyPoints: ['识别1-2浪结构', '2浪回调不破1浪起点', '放量突破时跟进', '目标位用斐波那契扩展'],
  },
  {
    id: 'macd_divergence',
    theory: '技术指标',
    title: 'MACD底背离案例',
    description: '某股票股价创新低，但MACD指标未创新低，形成底背离。随后股价企稳反弹，确认底部。',
    keyPoints: ['股价创新低', 'MACD未创新低', '等待金叉确认', '成交量配合放大'],
  },
];

export function LearningCenter() {
  const [activeTab, setActiveTab] = useState<LearningTab>('chanlun');
  const [activeLesson, setActiveLesson] = useState<string>('intro');

  const tabs: { id: LearningTab; label: string; icon: string }[] = [
    { id: 'chanlun', label: '缠论', icon: '📐' },
    { id: 'wave', label: '波浪', icon: '🌊' },
    { id: 'indicator', label: '指标', icon: '📊' },
    { id: 'pattern', label: 'K线形态', icon: '🕯️' },
    { id: 'position', label: '仓位管理', icon: '💼' },
    { id: 'cases', label: '经典案例', icon: '📚' },
    { id: 'compare', label: '多理论对比', icon: '🔄' },
    { id: 'review', label: '复盘', icon: '🔍' },
  ];

  const getLessons = (): Lesson[] => {
    switch (activeTab) {
      case 'chanlun': return chanlunLessons;
      case 'wave': return waveLessons;
      case 'indicator': return indicatorLessons;
      case 'pattern': return patternLessons;
      case 'position': return positionLessons;
      default: return [];
    }
  };

  const currentLessons = getLessons();
  const currentLesson = currentLessons.find(l => l.id === activeLesson) || currentLessons[0];

  return (
    <div className="flex flex-col h-full bg-[#0a0e17]">
      {/* Tab导航 */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-800 bg-[#111827]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              const lessons = tab.id === 'chanlun' ? chanlunLessons :
                             tab.id === 'wave' ? waveLessons :
                             tab.id === 'indicator' ? indicatorLessons :
                             tab.id === 'pattern' ? patternLessons :
                             tab.id === 'position' ? positionLessons : [];
              if (lessons.length > 0) setActiveLesson(lessons[0].id);
            }}
            className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
              activeTab === tab.id
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 经典案例 */}
        {activeTab === 'cases' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-200 mb-3">经典实战案例</h3>
            {classicCases.map(c => (
              <div key={c.id} className="bg-[#111827] rounded-lg border border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    {c.theory}
                  </span>
                  <h4 className="text-sm font-medium text-gray-200">{c.title}</h4>
                </div>
                <p className="text-xs text-gray-400 mb-3">{c.description}</p>
                <div className="space-y-1">
                  {c.keyPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 多理论对比 */}
        {activeTab === 'compare' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-200 mb-3">多理论对比学习</h3>
            <div className="bg-[#111827] rounded-lg border border-gray-800 p-4">
              <h4 className="text-sm font-medium text-gray-200 mb-3">同一走势的多视角分析</h4>
              <div className="space-y-3">
                <div className="border-l-2 border-purple-500 pl-3">
                  <div className="text-xs font-medium text-purple-400 mb-1">缠论视角</div>
                  <p className="text-xs text-gray-400">
                    关注走势结构：当前处于什么级别的什么走势类型？是否形成中枢？是否有背驰信号？买卖点是否出现？
                  </p>
                </div>
                <div className="border-l-2 border-blue-500 pl-3">
                  <div className="text-xs font-medium text-blue-400 mb-1">波浪理论视角</div>
                  <p className="text-xs text-gray-400">
                    关注浪型结构：当前处于第几浪？推动浪还是调整浪？目标位在哪里？需要遵守哪些铁律？
                  </p>
                </div>
                <div className="border-l-2 border-green-500 pl-3">
                  <div className="text-xs font-medium text-green-400 mb-1">技术指标视角</div>
                  <p className="text-xs text-gray-400">
                    关注信号确认：MACD是否金叉/死叉？KDJ是否超买/超卖？均线是否多头/空头排列？是否有背离？
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-[#111827] rounded-lg border border-gray-800 p-4">
              <h4 className="text-sm font-medium text-gray-200 mb-3">理论对比表</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-2 text-gray-400">维度</th>
                      <th className="text-left py-2 px-2 text-purple-400">缠论</th>
                      <th className="text-left py-2 px-2 text-blue-400">波浪理论</th>
                      <th className="text-left py-2 px-2 text-green-400">技术指标</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-2">核心思想</td>
                      <td className="py-2 px-2">走势结构分解</td>
                      <td className="py-2 px-2">浪型循环</td>
                      <td className="py-2 px-2">数学统计</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-2">适用场景</td>
                      <td className="py-2 px-2">趋势转折</td>
                      <td className="py-2 px-2">大级别趋势</td>
                      <td className="py-2 px-2">震荡/确认</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-2">优点</td>
                      <td className="py-2 px-2">精确买卖点</td>
                      <td className="py-2 px-2">预判目标位</td>
                      <td className="py-2 px-2">信号明确</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2">缺点</td>
                      <td className="py-2 px-2">学习曲线陡</td>
                      <td className="py-2 px-2">事后诸葛亮</td>
                      <td className="py-2 px-2">容易钝化</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 复盘 */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-200 mb-3">实战复盘系统</h3>
            <div className="bg-[#111827] rounded-lg border border-gray-800 p-4">
              <h4 className="text-sm font-medium text-gray-200 mb-3">复盘流程</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-medium">1</div>
                  <div>
                    <div className="text-xs font-medium text-gray-200">回顾交易记录</div>
                    <p className="text-xs text-gray-400">查看每笔交易的买入/卖出时机、持仓时间、盈亏情况</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-medium">2</div>
                  <div>
                    <div className="text-xs font-medium text-gray-200">分析决策依据</div>
                    <p className="text-xs text-gray-400">当时是基于什么信号/理论做出的决策？是否合理？</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-medium">3</div>
                  <div>
                    <div className="text-xs font-medium text-gray-200">总结教训</div>
                    <p className="text-xs text-gray-400">哪些操作是正确的？哪些是错误的？错误原因是什么？</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-medium">4</div>
                  <div>
                    <div className="text-xs font-medium text-gray-200">优化策略</div>
                    <p className="text-xs text-gray-400">基于复盘结果，调整交易策略和仓位管理方法</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-[#111827] rounded-lg border border-gray-800 p-4">
              <h4 className="text-sm font-medium text-gray-200 mb-3">常见错误类型</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: '追涨杀跌', desc: '在高点买入或低点卖出' },
                  { type: '仓位过重', desc: '单只股票仓位过大' },
                  { type: '止损不及时', desc: '亏损扩大才止损' },
                  { type: '频繁交易', desc: '过度交易增加成本' },
                  { type: '逆势操作', desc: '在下跌趋势中抄底' },
                  { type: '忽视大盘', desc: '不考虑市场环境' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-800/50 rounded p-2">
                    <div className="text-xs font-medium text-red-400">{item.type}</div>
                    <div className="text-xs text-gray-400">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 理论课程 */}
        {(activeTab === 'chanlun' || activeTab === 'wave' || activeTab === 'indicator' || 
          activeTab === 'pattern' || activeTab === 'position') && currentLesson && (
          <div className="flex gap-4">
            {/* 左侧课程列表 */}
            <div className="w-48 shrink-0">
              <div className="space-y-1">
                {currentLessons.map(lesson => (
                  <button
                    key={lesson.id}
                    onClick={() => setActiveLesson(lesson.id)}
                    className={`w-full text-left px-3 py-2 text-xs rounded transition-colors ${
                      activeLesson === lesson.id
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                    }`}
                  >
                    {lesson.title}
                  </button>
                ))}
              </div>
            </div>

            {/* 右侧课程内容 */}
            <div className="flex-1 min-w-0">
              <div className="bg-[#111827] rounded-lg border border-gray-800 p-4">
                <h3 className="text-sm font-medium text-gray-200 mb-3">{currentLesson.title}</h3>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">{currentLesson.content}</p>
                
                {/* 图示 */}
                {currentLesson.illustrations && currentLesson.illustrations.length > 0 && (
                  <div className="flex gap-4 mb-4">
                    {currentLesson.illustrations.map((illust, i) => (
                      <div key={i} className="bg-gray-800/50 rounded p-3 text-center">
                        <pre className="text-xs text-blue-400 font-mono mb-1">{illust.ascii}</pre>
                        <div className="text-xs text-gray-400">{illust.caption}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 要点 */}
                <div className="border-t border-gray-700 pt-3">
                  <h4 className="text-xs font-medium text-gray-300 mb-2">核心要点</h4>
                  <div className="space-y-1.5">
                    {currentLesson.keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
