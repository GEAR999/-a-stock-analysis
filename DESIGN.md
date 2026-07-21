# DESIGN.md

## 气质与意象
- 专业交易终端：深夜交易室，多屏闪烁，信息密度极高，一切为决策服务
- 暗色背景 + 红绿对比色，致敬同花顺/通达信/东方财富的经典交易界面
- 无多余装饰，每个像素都有信息价值

## 配色方案
- 背景主色：#0a0e17（深夜蓝黑）— 交易终端的深夜模式
- 面板背景：#111827（深灰蓝）— 信息卡片的底色
- 边框色：#1e293b（暗钢蓝）— 面板分隔线
- 主文字：#e2e8f0（冷银白）— 高可读性
- 次要文字：#94a3b8（灰蓝）— 辅助信息
- 涨（红）：#ef4444 / #dc2626 — A股传统红色代表上涨
- 跌（绿）：#22c55e / #16a34a — A股传统绿色代表下跌
- 强调色：#3b82f6（电光蓝）— 选中态、交互高亮
- 警告色：#f59e0b（琥珀黄）— 风险提示

## 字体排版
- 数字字体：JetBrains Mono（等宽，数据对齐）
- 中文字体：PingFang SC / Microsoft YaHei
- 信息密度优先，小字号 + 紧凑行距
- 价格数字使用等宽字体确保对齐

## 动效与交互
- 价格变动时短暂闪烁（红/绿背景闪烁 0.3s）
- 面板展开/折叠使用 200ms ease 过渡
- K线图切换周期时平滑过渡
- 避免大幅度动画，保持专业克制

## 设计禁忌
- 不要使用圆角过大的卡片（max 4px）
- 不要使用渐变背景
- 不要使用大面积亮色
- 不要使用卡通风格图标
- 不要使用过多阴影，用边框分隔代替

## 对比度与可见性体系
### 7套主题
- dark-blue（深蓝终端，默认）、light（明亮白）、dark-gray（深灰商务）、eye-green（护眼绿）、warm-orange（暖橙夜）、purple-night（紫夜科技）、deep-sea（深海冷静）

### 对比度CSS变量（每套主题独立定义）
- `--surface-raised`：浮起表面（tooltip/popover背景），比面板略亮
- `--surface-input`：输入框背景，比页面底色略暗
- `--surface-dropdown`：下拉框背景，与面板同色
- `--border-subtle`：次要边框（rgba白/黑 6-8%），用于卡片分隔
- `--border-strong`：主要边框（rgba白/黑 14-16%），用于输入框、弹窗
- `--text-placeholder`：占位符文字，对比度≥4.5:1
- `--text-disabled`：禁用文字，对比度≥3:1
- `--select-hover` / `--select-selected`：下拉选项hover/选中背景
- `--table-header-bg` / `--table-stripe-bg` / `--table-border`：表格层次
- `--scrollbar-track` / `--scrollbar-thumb` / `--scrollbar-thumb-hover`：滚动条
- `--sidebar-active-bg` / `--sidebar-hover-bg`：侧边栏导航状态

### 全局样式覆盖（globals.css）
- select/option、input/textarea、label、table、tabs、checkbox/radio、tooltip、dialog、progress、range、scrollbar、status-dot
- 所有样式通过CSS变量适配7套主题，无硬编码颜色
