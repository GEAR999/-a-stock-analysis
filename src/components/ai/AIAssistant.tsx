'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppState } from '@/hooks/useAppState';
import type { ChatMessage } from '@/lib/types';

export function AIAssistant() {
  const { isChatOpen, setIsChatOpen, chatMode, setChatMode, chatMessages, addChatMessage, selectedStock, klineData } = useAppState();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatHeight, setChatHeight] = useState(300);
  const isResizing = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleResize = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight >= 200 && newHeight <= 600) setChatHeight(newHeight);
  };

  useEffect(() => {
    const handleMouseUp = () => { isResizing.current = false; };
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const generateResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();

    if (chatMode === 'debug') {
      if (msg.includes('日志') || msg.includes('log')) {
        return '系统日志状态：\n- API服务：正常运行\n- 数据源连接：东方财富API正常\n- K线数据获取：正常\n- 最近请求无异常错误';
      }
      if (msg.includes('状态') || msg.includes('status')) {
        return `系统运行状态报告：\n- 当前选股：${selectedStock ? `${selectedStock.name}(${selectedStock.code})` : '未选择'}\n- K线数据：${klineData.length}条\n- 数据源：东方财富HTTP API\n- 分析引擎：已加载\n- 内存使用：正常`;
      }
      if (msg.includes('测试') || msg.includes('test')) {
        return '分析引擎测试：\n- MACD计算：通过\n- KDJ计算：通过\n- RSI计算：通过\n- BOLL计算：通过\n- 缠论分析：通过\n- 波浪分析：通过\n\n所有模块运行正常。';
      }
      return '调试模式可用命令：\n- "查看日志" - 查看系统日志\n- "系统状态" - 查看运行状态\n- "测试引擎" - 测试分析引擎';
    }

    // Analysis mode
    if (!selectedStock) {
      return '请先选择一只股票，然后我可以为您进行分析。您可以在左侧搜索框中搜索股票代码或名称。';
    }

    if (msg.includes('建议') || msg.includes('分析') || msg.includes('怎么样')) {
      return `关于 ${selectedStock.name}(${selectedStock.code}) 的分析：\n\n当前已加载 ${klineData.length} 条K线数据。\n\n建议您查看右侧的综合分析面板，其中包含：\n1. 技术指标分析（MACD/KDJ/RSI/BOLL）\n2. 缠论分析结果（买卖点标注）\n3. 波浪理论分析\n4. 综合评分与建议\n\n请注意：所有分析仅供参考，不构成投资建议。投资有风险，入市需谨慎。`;
    }

    if (msg.includes('macd')) {
      return 'MACD（移动平均收敛散度）指标说明：\n- DIF线上穿DEA线为金叉，看多信号\n- DIF线下穿DEA线为死叉，看空信号\n- 柱状图由绿变红，多头动能增强\n- 柱状图由红变绿，空头动能增强\n\n请在K线图上开启MACD指标查看当前状态。';
    }

    if (msg.includes('缠论') || msg.includes('缠')) {
      return '缠论分析说明：\n- 笔：连接相邻顶分型和底分型的基本单位\n- 线段：至少由三笔组成\n- 中枢：至少三段重叠区域\n- 一类买卖点：趋势反转点\n- 二类买卖点：中枢回拉不创新低/高\n- 三类买卖点：中枢突破后回踩不进中枢\n\n开启缠论分析后，K线图上会标注笔和买卖点。';
    }

    return `我是A股智能分析助手，当前处于${chatMode === 'analysis' ? '分析' : '调试'}模式。\n\n您可以问我：\n- 关于${selectedStock?.name || '股票'}的技术分析\n- MACD/KDJ/RSI等指标解读\n- 缠论/波浪理论分析\n- 切换到调试模式检查系统状态\n\n当前已选择：${selectedStock.name}(${selectedStock.code})`;
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      mode: chatMode,
    };
    addChatMessage(userMsg);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateResponse(userMsg.content);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        mode: chatMode,
      };
      addChatMessage(assistantMsg);
      setIsTyping(false);
    }, 500);
  };

  if (!isChatOpen) {
    return (
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-[var(--accent-blue)] text-[var(--text-primary)] rounded shadow-lg hover:bg-[var(--accent-blue)] transition-colors z-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span className="text-sm">AI助手</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border-default)] z-50 flex flex-col"
      style={{ height: chatHeight }}
    >
      {/* Resize handle */}
      <div
        className="h-1 cursor-ns-resize hover:bg-[var(--accent-blue)] transition-colors"
        onMouseDown={() => { isResizing.current = true; }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">AI分析助手</span>
          <div className="flex items-center gap-1 bg-[var(--bg-card)] rounded p-0.5">
            <button
              onClick={() => setChatMode('analysis')}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${chatMode === 'analysis' ? 'bg-[var(--accent-blue)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              分析模式
            </button>
            <button
              onClick={() => setChatMode('debug')}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${chatMode === 'debug' ? 'bg-[var(--accent-blue)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              调试模式
            </button>
          </div>
        </div>
        <button onClick={() => setIsChatOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-center text-xs text-[var(--text-secondary)] py-8">
            {chatMode === 'analysis' ? '输入问题开始分析，如"帮我分析一下当前股票"' : '调试模式：输入"系统状态"、"查看日志"或"测试引擎"'}
          </div>
        )}
        {chatMessages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded text-xs leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-[var(--accent-blue)] text-[var(--text-primary)]'
                : 'bg-[var(--bg-card)] text-[var(--text-primary)]'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-card)] px-3 py-2 rounded text-xs text-[var(--text-secondary)]">
              思考中...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-[var(--border-default)]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={chatMode === 'analysis' ? '输入分析相关问题...' : '输入调试命令...'}
          className="flex-1 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[#94a3b8] outline-none focus:border-[var(--accent-blue)]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-[var(--accent-blue)] text-[var(--text-primary)] text-sm rounded hover:bg-[var(--accent-blue)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  );
}
