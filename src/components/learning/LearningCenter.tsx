'use client';

import { useState } from 'react';
import {
  chanlunLessons, waveLessons, indicatorLessons,
  patternLessons, positionLessons, classicCases, glossaryItems,
  type Lesson, type GlossaryItem,
} from './learning-data';

type LearningTab = 'chanlun' | 'wave' | 'indicator' | 'pattern' | 'position' | 'cases' | 'compare' | 'review' | 'glossary';

export function LearningCenter() {
  const [activeTab, setActiveTab] = useState<LearningTab>('chanlun');
  const [activeLesson, setActiveLesson] = useState<string>('intro');
  const [glossaryFilter, setGlossaryFilter] = useState<'all' | 'chanlun' | 'wave' | 'indicator'>('all');
  const [glossarySearch, setGlossarySearch] = useState('');

  const tabs: { id: LearningTab; label: string; icon: string }[] = [
    { id: 'chanlun', label: '缠论', icon: '📐' },
    { id: 'wave', label: '波浪', icon: '🌊' },
    { id: 'indicator', label: '指标', icon: '📊' },
    { id: 'pattern', label: 'K线形态', icon: '🕯️' },
    { id: 'position', label: '仓位管理', icon: '💼' },
    { id: 'cases', label: '经典案例', icon: '📚' },
    { id: 'compare', label: '多理论对比', icon: '🔄' },
    { id: 'review', label: '复盘', icon: '🔍' },
    { id: 'glossary', label: '术语速查', icon: '📖' },
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

  const filteredGlossary = glossaryItems.filter(item => {
    const matchCategory = glossaryFilter === 'all' || item.category === glossaryFilter;
    const matchSearch = !glossarySearch ||
      item.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      item.definition.toLowerCase().includes(glossarySearch.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'chanlun': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'wave': return 'text-[var(--accent-blue)] bg-blue-500/10 border-[var(--accent-blue)]/20';
      case 'indicator': return 'text-[var(--accent-green)] bg-green-500/10 border-green-500/20';
      default: return 'text-[var(--text-secondary)] bg-[var(--text-secondary)]/10 border-[var(--text-secondary)]/20';
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'chanlun': return '缠论';
      case 'wave': return '波浪';
      case 'indicator': return '指标';
      default: return category;
    }
  };

  const handleTabChange = (tabId: LearningTab) => {
    setActiveTab(tabId);
    const lessons = tabId === 'chanlun' ? chanlunLessons :
                   tabId === 'wave' ? waveLessons :
                   tabId === 'indicator' ? indicatorLessons :
                   tabId === 'pattern' ? patternLessons :
                   tabId === 'position' ? positionLessons : [];
    if (lessons.length > 0) setActiveLesson(lessons[0].id);
  };

  const isLessonTab = activeTab === 'chanlun' || activeTab === 'wave' || activeTab === 'indicator' ||
                      activeTab === 'pattern' || activeTab === 'position';

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Tab导航 */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-[var(--border-default)] bg-[var(--bg-panel)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
              activeTab === tab.id
                ? 'bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                : 'bg-[var(--bg-card)]/50 text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/50 hover:text-[var(--text-primary)]'
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
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">A股经典走势案例库</h3>
            {classicCases.map(c => (
              <div key={c.id} className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`px-2 py-0.5 text-xs rounded border ${
                    c.theory === '缠论' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                    c.theory === '波浪理论' ? 'bg-blue-500/20 text-[var(--accent-blue)] border-[var(--accent-blue)]/30' :
                    c.theory === '技术指标' ? 'bg-green-500/20 text-[var(--accent-green)] border-green-500/30' :
                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    {c.theory}
                  </span>
                  {c.stock && <span className="text-xs text-[var(--text-secondary)] font-mono">{c.stock}</span>}
                  {c.period && <span className="text-xs text-[var(--text-secondary)]">{c.period}</span>}
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">{c.title}</h4>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">{c.description}</p>
                <div className="space-y-1">
                  {c.keyPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-primary)]">
                      <span className="text-[var(--accent-blue)] mt-0.5 shrink-0">•</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 术语速查表 */}
        {activeTab === 'glossary' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">术语速查表</h3>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="搜索术语..."
                value={glossarySearch}
                onChange={(e) => setGlossarySearch(e.target.value)}
                className="flex-1 min-w-[150px] px-3 py-1.5 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-[var(--accent-blue)]/50"
              />
              <div className="flex gap-1">
                {(['all', 'chanlun', 'wave', 'indicator'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setGlossaryFilter(cat)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      glossaryFilter === cat
                        ? 'bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                        : 'bg-[var(--bg-card)]/50 text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/50'
                    }`}
                  >
                    {cat === 'all' ? '全部' : getCategoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              {filteredGlossary.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-3 py-2 rounded bg-[var(--bg-card)]/30 hover:bg-[var(--bg-card)]/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 shrink-0 min-w-[120px]">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getCategoryColor(item.category)}`}>
                      {getCategoryLabel(item.category)}
                    </span>
                    <span className="text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] transition-colors">
                      {item.term}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] leading-relaxed">{item.definition}</span>
                </div>
              ))}
              {filteredGlossary.length === 0 && (
                <div className="text-center text-xs text-[var(--text-secondary)] py-8">未找到匹配的术语</div>
              )}
            </div>
            <div className="text-xs text-[var(--text-secondary)] text-right">
              共 {filteredGlossary.length} 个术语
            </div>
          </div>
        )}

        {/* 多理论对比 */}
        {activeTab === 'compare' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">多理论对比学习</h3>
            <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">同一走势的多视角分析</h4>
              <div className="space-y-3">
                <div className="border-l-2 border-purple-500 pl-3">
                  <div className="text-xs font-medium text-purple-400 mb-1">缠论视角</div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    关注走势结构：当前处于什么级别的什么走势类型？是否形成中枢？是否有背驰信号？买卖点是否出现？
                  </p>
                </div>
                <div className="border-l-2 border-[var(--accent-blue)] pl-3">
                  <div className="text-xs font-medium text-[var(--accent-blue)] mb-1">波浪理论视角</div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    关注浪型结构：当前处于第几浪？推动浪还是调整浪？目标位在哪里？需要遵守哪些铁律？
                  </p>
                </div>
                <div className="border-l-2 border-green-500 pl-3">
                  <div className="text-xs font-medium text-[var(--accent-green)] mb-1">技术指标视角</div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    关注信号确认：MACD是否金叉/死叉？KDJ是否超买/超卖？均线是否多头/空头排列？是否有背离？
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">理论对比表</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-default)]">
                      <th className="text-left py-2 px-2 text-[var(--text-secondary)]">维度</th>
                      <th className="text-left py-2 px-2 text-purple-400">缠论</th>
                      <th className="text-left py-2 px-2 text-[var(--accent-blue)]">波浪理论</th>
                      <th className="text-left py-2 px-2 text-[var(--accent-green)]">技术指标</th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--text-primary)]">
                    {[
                      ['核心思想', '走势结构分解', '浪型循环', '数学统计'],
                      ['适用场景', '趋势转折', '大级别趋势', '震荡/确认'],
                      ['优点', '精确买卖点', '预判目标位', '信号明确'],
                      ['缺点', '学习曲线陡', '事后诸葛亮', '容易钝化'],
                      ['学习难度', '极高', '高', '中'],
                      ['实战价值', '极高', '高', '中高'],
                      ['最佳搭配', 'MACD验证背驰', '斐波那契验证', '多指标共振'],
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-[var(--border-default)]">
                        {row.map((cell, j) => (
                          <td key={j} className={`py-2 px-2 ${j === 0 ? 'text-[var(--text-secondary)]' : ''}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 复盘 */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">实战复盘系统</h3>
            <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">复盘流程</h4>
              <div className="space-y-3">
                {[
                  { title: '回顾交易记录', desc: '查看每笔交易的买入/卖出时机、持仓时间、盈亏情况' },
                  { title: '分析决策依据', desc: '当时是基于什么信号/理论做出的决策？是否合理？' },
                  { title: '总结教训', desc: '哪些操作是正确的？哪些是错误的？错误原因是什么？' },
                  { title: '优化策略', desc: '基于复盘结果，调整交易策略和仓位管理方法' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 text-[var(--accent-blue)] flex items-center justify-center text-xs font-medium shrink-0">{i + 1}</div>
                    <div>
                      <div className="text-xs font-medium text-[var(--text-primary)]">{step.title}</div>
                      <p className="text-xs text-[var(--text-secondary)]">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">常见错误类型</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: '追涨杀跌', desc: '在高点买入或低点卖出' },
                  { type: '仓位过重', desc: '单只股票仓位过大' },
                  { type: '止损不及时', desc: '亏损扩大才止损' },
                  { type: '频繁交易', desc: '过度交易增加成本' },
                  { type: '逆势操作', desc: '在下跌趋势中抄底' },
                  { type: '忽视大盘', desc: '不考虑市场环境' },
                ].map((item, i) => (
                  <div key={i} className="bg-[var(--bg-card)]/50 rounded p-2">
                    <div className="text-xs font-medium text-[var(--accent-red)]">{item.type}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 理论课程 */}
        {isLessonTab && currentLesson && (
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
                        ? 'bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/50 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {lesson.title}
                  </button>
                ))}
              </div>
            </div>

            {/* 右侧课程内容 */}
            <div className="flex-1 space-y-4">
              <h3 className="text-lg font-medium text-[var(--text-primary)]">{currentLesson.title}</h3>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{currentLesson.content}</p>

              {/* 要点 */}
              <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">核心要点</h4>
                <div className="space-y-2">
                  {currentLesson.keyPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-primary)]">
                      <span className="text-[var(--accent-blue)] mt-0.5 shrink-0">•</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 案例 */}
              {currentLesson.cases && currentLesson.cases.length > 0 && (
                <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">实战案例</h4>
                  <div className="space-y-3">
                    {currentLesson.cases.map((c, i) => (
                      <div key={i} className="border-l-2 border-[var(--accent-blue)]/50 pl-3">
                        <div className="text-xs font-medium text-[var(--accent-blue)] mb-1">{c.title}</div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 图示 */}
              {currentLesson.illustrations && currentLesson.illustrations.length > 0 && (
                <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">图示说明</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {currentLesson.illustrations.map((ill, i) => (
                      <div key={i} className="text-center">
                        <div className="bg-[var(--bg-card)]/50 rounded p-4 mb-2">
                          <pre className="text-xs text-[var(--accent-green)] font-mono whitespace-pre">{ill.ascii}</pre>
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">{ill.caption}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
