# AGENTS.md

## 项目概览
A股智能分析系统 - 专业的股票分析Web应用，支持缠论、波浪理论、技术指标分析。

## 技术栈
- Next.js 16 (App Router) + React 19 + TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- ECharts (K线图渲染)
- 数据源：东方财富HTTP API

## 目录结构
```
src/
├── app/
│   ├── api/stock/route.ts    # 统一股票API (search/quote/kline/sentiment/sector_list/sector_sentiment/stock_sentiment/comprehensive_sentiment)
│   ├── layout.tsx             # 根布局 (dark mode)
│   ├── page.tsx               # 主页面 (三栏布局)
│   └── globals.css            # 全局样式 + 交易终端主题
├── components/
│   ├── SentimentTooltip.tsx   # 情绪指标Tooltip组件 (hover显示计算过程)
│   ├── ai/AIAssistant.tsx     # AI对话助手 (分析/调试模式)
│   ├── analysis/
│   │   ├── AnalysisPanel.tsx  # 分析引擎开关面板 (三个理论开关)
│   │   ├── AnalysisTooltip.tsx # 分析结果Tooltip组件 (缠论/波浪/技术指标)
│   │   ├── AdvicePanel.tsx    # 综合建议面板
│   │   ├── ChanlunCard.tsx    # 缠论分析独立卡片 (紫色主题)
│   │   ├── WaveCard.tsx       # 波浪理论分析独立卡片 (蓝色主题)
│   │   ├── TechnicalCard.tsx  # 技术指标分析独立卡片 (绿色主题)
│   │   ├── ComprehensiveAnalysis.tsx # 综合分析卡片 (金色边框,动态汇总)
│   │   └── TrendOutlook.tsx   # 走势研判与展望 (多路径推演+应对策略)
│   ├── chart/
│   │   ├── KLineChart.tsx     # ECharts K线图 (主图+副图+图例)
│   │   └── QuoteHeader.tsx    # 行情信息头
│   ├── layout/
│   │   ├── Sidebar.tsx        # 左侧栏 (搜索+自选+情绪)
│   │   └── RightPanel.tsx     # 右侧栏 (分析+建议)
│   ├── sentiment/SentimentPanel.tsx  # 市场情绪面板 (大盘/板块/个股三维度+跟随开关+全市场板块)
│   ├── macro/MacroEconomyPanel.tsx   # 宏观经济分析面板 (中国/美国/欧洲/日本/韩国+经济指标+综合评估)
│   ├── industry/IndustryMappingPanel.tsx # 产业链映射分析 (美股/日韩产业链映射)
│   ├── backtest/
│   │   ├── types.ts           # 回测类型定义
│   │   └── BacktestPanel.tsx  # 模拟回测面板 (交易记录+持仓+资金曲线+收益统计+仓位管理)
│   ├── sidebar/
│   │   ├── StockSearch.tsx    # 股票搜索组件
│   │   └── WatchList.tsx      # 自选股列表 (拖拽排序)
│   └── ui/                    # shadcn/ui 组件
├── hooks/
│   └── useAppState.tsx        # 全局状态管理 (Context)
├── lib/
│   ├── api/stock.ts           # 数据获取层 (东方财富API)
│   ├── analysis.ts            # 分析引擎 (缠论/波浪/技术指标)
│   ├── types.ts               # 类型定义
│   └── utils.ts               # 工具函数
└── services/
    └── sentiment/             # 情绪分析服务
        ├── types.ts           # 情绪分析类型定义
        ├── market-sentiment.ts  # 大盘情绪算法 (8指标加权)
        ├── sector-sentiment.ts  # 板块情绪算法 (5指标加权)
        ├── stock-sentiment.ts   # 个股情绪算法 (7指标加权+标签)
        └── sentiment-panel.ts   # 综合评估模块
```

## API 接口
- `GET /api/stock?action=search&keyword={code}` - 搜索股票
- `GET /api/stock?action=quote&code={code}` - 实时行情
- `GET /api/stock?action=kline&code={code}&period={period}&limit={n}` - K线数据
- `GET /api/stock?action=sentiment` - 大盘市场情绪
- `GET /api/stock?action=sector_list` - 获取全市场板块列表（实时数据）
- `GET /api/stock?action=sector_sentiment&sector={code}` - 板块情绪分析（实时数据，支持板块代码或名称）
- `GET /api/stock?action=stock_sentiment&code={code}` - 个股情绪分析（实时数据，技术强度/量能/动量/支撑压力）
- `GET /api/stock?action=comprehensive_sentiment` - 综合情绪评估（大盘/板块/个股三维度）

K线周期: daily/weekly/monthly/60min/30min/15min/5min

## 情绪分析系统
- 大盘情绪：8个指标加权（涨跌家数比/涨停跌停比/成交额偏离度/连板高度/封板成功率/北向资金/两融变化/新高新低差）
- 板块情绪：5个指标加权（板块涨跌比/主力资金流向/换手率/龙头强度/持续性）
- 个股情绪：7个指标加权（量比/换手分位/大单净流入/分时强度/封板涨幅/龙虎榜/融资变化）+ 自动标签
- 每个指标都有Tooltip，hover显示计算过程和解释

## 分析引擎
- 缠论分析：自动识别笔、线段、中枢，标注买卖点（一二三类买卖点）
- 波浪理论：自动识别推动浪（5浪）和调整浪（3浪），标注浪型
- 技术分析：MACD、KDJ、RSI、布林带（BOLL）、均线系统（MA5/10/20/60/120/250）
- 每个理论有独立分析卡片，开关控制显示/隐藏
  - 缠论分析卡片（紫色主题）：当前阶段、走势研判、多路径推演、操作建议、风险提示
  - 波浪理论卡片（蓝色主题）：当前浪型、走势研判、浪型推演、操作建议、风险提示
  - 技术指标卡片（绿色主题）：指标共振、各指标信号、支撑压力位、走势推演、操作建议
- 综合分析卡片（金色边框，始终显示）：
  - 根据开启的理论数量动态汇总
  - 多理论共振点/分歧点分析
  - 综合操作建议和风险等级
- 每个分析项带Tooltip（hover显示结论/依据/可信度/解释）
- 分析结果叠加显示在K线图上

## 开发命令
- `pnpm dev` - 启动开发服务
- `pnpm build` - 构建生产版本
- `pnpm start` - 启动生产服务

## 关键设计决策
- 深色交易终端主题 (#0a0e17 背景)
- 红涨绿跌 (A股惯例)
- 等宽数字字体 (font-mono-num)
- 数据通过后端API代理获取 (避免CORS)
- 状态管理使用 React Context
- 分析引擎纯前端计算
- K线图支持图例说明（点击"图例"按钮查看各标注含义）
- 情绪面板支持个股/板块/大盘三维度切换
- 波浪理论使用自适应枢轴点检测，支持推动浪(1-5)和调整浪(A-C)标注
