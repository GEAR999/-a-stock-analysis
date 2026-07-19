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
│   ├── api/stock/route.ts    # 统一股票API (search/quote/kline/sentiment)
│   ├── layout.tsx             # 根布局 (dark mode)
│   ├── page.tsx               # 主页面 (三栏布局)
│   └── globals.css            # 全局样式 + 交易终端主题
├── components/
│   ├── ai/AIAssistant.tsx     # AI对话助手 (分析/调试模式)
│   ├── analysis/
│   │   ├── AnalysisPanel.tsx  # 分析引擎开关面板
│   │   └── AdvicePanel.tsx    # 综合建议面板
│   ├── chart/
│   │   ├── KLineChart.tsx     # ECharts K线图 (主图+副图)
│   │   └── QuoteHeader.tsx    # 行情信息头
│   ├── layout/
│   │   ├── Sidebar.tsx        # 左侧栏 (搜索+自选+情绪)
│   │   └── RightPanel.tsx     # 右侧栏 (分析+建议)
│   ├── sentiment/SentimentPanel.tsx  # 市场情绪面板
│   ├── sidebar/
│   │   ├── StockSearch.tsx    # 股票搜索组件
│   │   └── WatchList.tsx      # 自选股列表 (拖拽排序)
│   └── ui/                    # shadcn/ui 组件
├── hooks/
│   └── useAppState.tsx        # 全局状态管理 (Context)
└── lib/
    ├── api/stock.ts           # 数据获取层 (东方财富API)
    ├── analysis.ts            # 分析引擎 (缠论/波浪/技术指标)
    ├── types.ts               # 类型定义
    └── utils.ts               # 工具函数
```

## API 接口
- `GET /api/stock?action=search&keyword={code}` - 搜索股票
- `GET /api/stock?action=quote&code={code}` - 实时行情
- `GET /api/stock?action=kline&code={code}&period={period}&limit={n}` - K线数据
- `GET /api/stock?action=sentiment` - 市场情绪

K线周期: daily/weekly/monthly/60min/30min/15min/5min

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
