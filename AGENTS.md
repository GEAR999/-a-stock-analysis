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
│   ├── SyncStatusIndicator.tsx # 云端同步状态指示器 (顶部工具栏)
│   ├── ai/
│   │   ├── AIAssistant.tsx    # AI对话助手 (分析/调试模式)
│   │   ├── AIChatWidget.tsx   # AI悬浮对话窗 (右下角浮动)
│   │   ├── AIAnalysis.tsx     # AI嵌入式分析通用组件
│   │   └── AIEmbedToggle.tsx  # AI增强开关组件
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
│   │   ├── types.ts           # 回测类型定义 (Account/Trade/Position/StrategyMetrics等)
│   │   ├── storage.ts         # 数据持久化层 (IndexedDB CRUD + 业务逻辑)
│   │   ├── idb-account-storage.ts # IndexedDB迁移层 (localStorage→IDB)
│   │   ├── strategy-storage.ts # 策略存储与权重计算 (最大余数法)
│   │   ├── strategy-bridge.ts  # 策略桥接模块 (理论↔信号双向映射, resolveStrategyTypes)
│   │   ├── BacktestPanel.tsx  # 模拟回测主面板 (Tab切换+子组件编排, ~194行)
│   │   ├── AccountOverview.tsx # 账户概览子组件 (总资产/盈亏/持仓/资金曲线+锁定状态)
│   │   ├── ManualTradePanel.tsx # 手动买卖子组件 (买入/卖出对话框)
│   │   ├── QuantAutoTradePanel.tsx # 量化自动交易子组件 (策略配置/信号检测/自动买卖/止损止盈/运行日志)
│   │   ├── TradeHistoryPanel.tsx # 交易记录子组件 (筛选/排序/CSV导出)
│   │   ├── HistoryBacktestPanel.tsx # 历史回测面板 (策略选择/回测执行/结果展示)
│   │   ├── IndependentBacktest.tsx # 独立回测面板 (不依赖账户,股票+周期+策略+结果)
│   │   ├── BacktestChart.tsx  # K线买卖点标注图 (ECharts+Markers+详情卡片)
│   │   ├── backtest-indicators.ts # 回测技术指标计算 (MACD/KDJ/RSI/BOLL/MA)
│   │   ├── TradingStatusIndicator.tsx # 交易时段状态指示器
│   │   ├── hooks/useAccountManager.ts # 账户管理Hook
│   │   └── utils.ts           # 回测公共工具函数
│   ├── strategy/
│   │   ├── StrategyLibrary.tsx # 策略库页面 (分类/搜索/排序/管理)
│   │   ├── StrategyCard.tsx   # 策略卡片组件 (名称/描述/使用次数/操作)
│   │   └── AIStrategyGenerator.tsx # AI策略生成器 (需求描述→策略参数)
│   ├── sidebar/
│   │   ├── StockSearch.tsx    # 股票搜索组件
│   │   └── WatchList.tsx      # 自选股列表 (拖拽排序)
│   └── ui/                    # shadcn/ui 组件
├── hooks/
│   └── useAppState.tsx        # 全局状态管理 (Context)
├── lib/
│   ├── api/stock.ts           # 数据获取层 (东方财富API, 含分页拉取)
│   ├── api-client-db.ts       # 统一云端API客户端 (账户/交易/持仓/自选股/策略/缓存)
│   ├── db.ts                  # Neon数据库连接 (serverless PostgreSQL)
│   ├── data-source.ts         # 统一数据源管理器 (Tushare→东方财富→缓存 三级降级)
│   ├── ai-embed.ts            # AI嵌入式分析工具库 (callEmbeddedAI/useAIEmbed)
│   ├── analysis.ts            # 分析引擎 (缠论/波浪/技术指标)
│   ├── backtest-engine.ts     # 历史回测引擎 (基础策略+分析引擎策略适配器+进度回调)
│   ├── backtest-reasoning.ts  # AI买卖依据生成器 (数据快照+DeepSeek分析)
│   ├── strategy-library.ts    # 策略库存储逻辑 (内置/自定义/AI生成+收藏+使用统计)
│   ├── idb-cache.ts           # IndexedDB K线缓存 (24h有效期, LRU清理)
│   ├── trading-time.ts        # A股交易时间判断
│   ├── slippage.ts            # 滑点模拟
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

### Neon 数据库 API（云端持久化）
- `GET /api/migrate` - 检查数据库迁移状态（10张表）
- `GET/POST /api/accounts` - 账户管理（CRUD）
- `GET/PUT/DELETE /api/accounts/[id]` - 账户详情/更新/删除
- `GET/POST /api/transactions` - 交易记录（买入/卖出）
- `GET/DELETE /api/transactions/[id]` - 交易详情/删除
- `GET /api/positions` - 持仓列表
- `DELETE /api/positions/[id]` - 平仓操作
- `GET/POST/DELETE /api/watchlist` - 自选股管理
- `GET /api/strategies` - 策略列表（含内置+自定义）
- `GET/POST/DELETE /api/strategies/custom` - 自定义策略管理
- `GET/PUT /api/strategy-weights` - 策略权重配置
- `GET/POST/DELETE /api/analysis-cache` - 分析结果缓存
- `POST /api/ai/chat` - DeepSeek AI 对话（流式输出）
- `GET/POST /api/learning/progress` - 学习进度管理

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

## 模拟回测系统
- 多账户管理：支持创建/切换/删除多个独立账户，每个账户有独立的资金、持仓、交易记录
- 股票买入额度：每只股票可单独设置买入上限，超额自动拒绝
- 跟踪机制：只有加入跟踪列表的股票才能触发自动操作
- 自动操作流程：检查跟踪列表 → 检查买入额度 → 检查资金 → 执行买入
- 数据持久化：所有数据通过 IndexedDB 持久化存储（自动从 localStorage 迁移）
- 数据清理：支持清理垃圾数据（已平仓30天+记录）和重置账户（保留跟踪列表和额度设置）
- 手动交易：支持手动买入/卖出操作
- 资金曲线：SVG 绘制的30天资金走势曲线（基于真实交易数据计算）
- 策略指标：累计收益率、年化收益率、最大回撤、夏普比率、胜率、盈亏比
- 滑点模拟：买入上浮0.1%-0.3%，卖出下调0.1%-0.3%
- 交易时段控制：自动判断A股交易时间（工作日9:30-11:30, 13:00-15:00）
- 历史回测引擎：支持10种基础技术指标策略 + 6种分析引擎策略（缠论买卖点、波浪起点/终点、指标共振买卖）
- 分析引擎策略互通：历史回测复用 analysis.ts 的 analyzeChanlun/analyzeWaves/getAllIndicators
- 回测进度回调：onProgress(current, total) 实时显示回测进度

## 云端数据同步
- **双写模式**：localStorage 为主存储（快速响应），Neon PostgreSQL 为云端备份
- **防抖同步**：账户数据变更后 1 秒防抖，自动同步到云端
- **UUID 校验**：API 端对 accountId/userId 做 UUID 格式校验，非法值返回空列表（兼容旧数据）
- **自选股同步**：watchlist 变更时自动同步到云端
- **同步状态指示**：SyncStatusIndicator 组件显示实时同步状态（idle/syncing/synced/error）
- **数据库迁移**：GET /api/migrate 检查 10 张表是否全部创建
- **存储层函数**：syncAccountToCloud / syncWatchlistToCloud / debouncedSyncAccount（storage.ts 底部）

## 历史回测系统（独立功能）
- **独立回测面板**：IndependentBacktest.tsx — 不依赖"账户"概念，独立运行回测
  - 股票代码搜索输入
  - 回测周期选择（起止日期）
  - 策略多选（从策略库选取）
  - 初始资金设定
  - 回测结果展示：总收益率、年化收益率、最大回撤、夏普比率、胜率、交易次数、盈亏比
  - CSV导出（交易记录 + 性能报告）
- **K线买卖点标注**：BacktestChart.tsx — 基于ECharts的K线图+买卖点标记
  - 买入标记：红色上箭头（A股红涨）
  - 卖出标记：绿色下箭头（A股绿跌）
  - 点击标记弹出详情卡片：交易时间、价格、数量、触发策略、AI买卖依据
- **AI买卖依据生成**：backtest-reasoning.ts + /api/backtest/reasoning
  - 每笔交易记录触发时刻的数据快照（OHLCV + 技术指标值）
  - 调用DeepSeek生成详细买卖依据分析
  - 所有数据基于真实K线计算，禁止编造
  - 异步批量处理，不阻塞结果展示

## 策略库系统
- **策略存储**：strategy-library.ts — 策略库管理逻辑
  - 三类策略：内置(builtin) / 自定义(custom) / AI生成(ai_generated)
  - 收藏、使用次数统计、标签管理
  - 本地缓存 + Neon云端同步
- **策略库页面**：StrategyLibrary.tsx + StrategyCard.tsx
  - 分类标签筛选（全部/内置/自定义/AI生成/收藏）
  - 搜索、排序
  - 快捷操作：编辑、复制、删除、收藏
- **AI策略生成器**：AIStrategyGenerator.tsx
  - 用户描述需求 → DeepSeek生成策略参数和规则
  - 生成后预览、编辑、保存到策略库
- **策略锁定**：量化验证账户创建后策略参数锁定不可更改
  - Account类型新增 `locked?: boolean` 字段
  - 创建量化账户时自动设置 locked=true
  - AccountOverview显示锁定状态提示

## API接口（新增）
- `POST /api/backtest/reasoning` - AI买卖依据生成（批量）
- `GET /api/strategies` - 策略列表（含内置+自定义+AI生成）
- `GET/POST/DELETE /api/strategies/custom` - 自定义策略管理
- `PUT /api/strategies/custom/[id]` - 更新自定义策略

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
- 回测系统数据通过 localStorage 持久化，支持多账户独立管理
- 回测系统自动操作需先加入跟踪列表，再检查额度和资金后才执行
- 策略桥接层(strategy-bridge.ts)连接抽象理论维度(QuantStrategy.theories)与具体信号维度(StrategyType)，支持双向映射
- 量化自动交易引擎：30秒轮询检测跟踪列表信号，支持止损止盈自动触发，运行日志实时展示
