# 量化实时账户 - 问题诊断与修复

## 问题现象

定时任务日志显示：
```
[Cron] Running scheduled check...
找到 0 个活跃账户
```

但数据库查询显示有 2 个账户：
- `000001` - 状态：`paused`
- `600519` - 状态：`active`

## 根本原因

**定时任务执行流程**：
1. 查询 `status = 'active'` 的账户 ✓（找到 600519）
2. 对每个账户调用 `runAccountCheck(accountId)`
3. 在 `runAccountCheck` 中查询账户关联的策略快照 ✗
4. 如果没有有效策略快照，**直接跳过**（第 278-281 行）

**为什么没有策略快照？**
- 前端创建账户时只传递了：`name, stock_code, stock_name, initial_capital`
- 后端代码（第 100-105 行）只在 `req.body.strategy_config` 存在时才创建策略快照
- 因此，现有账户都没有关联的策略快照

## 修复方案

### 方案 1：修改后端代码（已实施）

修改 `/workspace/projects/quant-live-service/index.js` 第 100-105 行：

**修改前**：
```javascript
if (req.body.strategy_config) {
  await sql`
    INSERT INTO quant_live_strategy_snapshots ...
    VALUES (..., ${JSON.stringify(req.body.strategy_config)}, ...)
  `;
}
```

**修改后**：
```javascript
// 创建策略快照（如果没有提供，使用默认配置）
const strategyConfig = req.body.strategy_config || {
  name: '默认策略',
  signals: ['macd_golden_cross', 'kdj_oversold'],
  position: { maxTotal: 0.8, maxSingle: 0.3, minCash: 0.1 },
  risk: { stopLoss: 0.05, takeProfit: 0.15 },
  cost: { commission: 0.0003, slippage: 0.002 }
};

await sql`
  INSERT INTO quant_live_strategy_snapshots ...
  VALUES (..., ${JSON.stringify(strategyConfig)}, ...)
`;
```

### 方案 2：为现有账户手动添加策略快照（备选）

如果不想重启服务，可以直接在数据库中执行：

```sql
INSERT INTO quant_live_strategy_snapshots 
  (account_id, strategy_id, strategy_name, strategy_config, effective_from)
VALUES (
  '27536f69-170f-4512-8324-c9e893d31868',  -- 600519 账户 ID
  'default',
  '默认策略',
  '{"name":"默认策略","signals":["macd_golden_cross","kdj_oversold"],"position":{"maxTotal":0.8,"maxSingle":0.3,"minCash":0.1},"risk":{"stopLoss":0.05,"takeProfit":0.15},"cost":{"commission":0.0003,"slippage":0.002}}',
  NOW()
);
```

## 部署步骤

### 1. 上传修改后的代码

```bash
scp /workspace/projects/quant-live-service/index.js admin@47.122.115.203:/opt/quant-live-service/index.js
```

### 2. 重启服务

```bash
ssh admin@47.122.115.203
cd /opt/quant-live-service
pm2 restart quant-live-service
pm2 logs quant-live-service --lines 50
```

### 3. 验证修复

等待下一个交易时间（工作日 9:30-11:30 或 13:00-15:00），观察日志应该显示：

```
[Cron] Running scheduled check...
找到 1 个活跃账户
检查账户：xxx (600519)
开始检查账户 xxx
获取到 xxx 条分时数据，开始信号检测...
```

## 后续优化

1. **前端策略选择**：创建账户时让用户选择策略（可选）
2. **信号检测实现**：完善 `runAccountCheck` 中的 TODO 部分
3. **自动交易执行**：信号触发后自动买卖
4. **WebSocket 推送**：部署 HTTPS 后启用 WSS

## 代码位置

- 后端服务：`/workspace/projects/quant-live-service/index.js`
  - 创建账户 API：第 85-112 行
  - 账户检查函数：第 252-305 行
  - Cron 定时任务：第 310-332 行

- 前端组件：`/workspace/projects/src/components/quant-live/`
  - `useQuantLiveMonitor.ts` - Hook（创建账户逻辑）
  - `QuantLivePanel.tsx` - UI 面板
