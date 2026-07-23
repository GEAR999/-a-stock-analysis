# 量化实时服务部署说明

## 问题诊断

数据库查询显示有 2 个账户：
- `000001` - 状态：`paused`
- `600519` - 状态：`active`

但定时任务日志显示"找到 0 个活跃账户"，原因是：
1. 代码查询 `status = 'active'` ✓
2. 数据库有 `active` 状态的账户 ✓
3. **但账户没有关联的策略快照记录** ✗

## 根本原因

前端创建账户时没有传递 `strategy_config`，后端代码只在有 `strategy_config` 时才创建策略快照。

定时任务执行流程：
1. 查询活跃账户 ✓
2. 查询账户关联的策略快照 ✗（没有记录）
3. 如果没有有效策略，跳过检查

## 修复方案

已修改 `/workspace/projects/quant-live-service/index.js`：
- 创建账户时如果没有提供 `strategy_config`，自动创建默认策略快照
- 默认策略包含：MACD 金叉 + KDJ 超卖信号，仓位控制，止损止盈

## 部署步骤

由于当前环境无法 SSH 到阿里云服务器，请手动执行以下命令：

### 1. 上传修改后的代码

在本地执行：
```bash
scp /workspace/projects/quant-live-service/index.js admin@47.122.115.203:/opt/quant-live-service/index.js
```

### 2. 重启服务

SSH 到服务器后执行：
```bash
ssh admin@47.122.115.203
cd /opt/quant-live-service
pm2 restart quant-live-service
pm2 logs quant-live-service --lines 50
```

### 3. 验证修复

等待下一个交易时间（工作日 9:30-11:30 或 13:00-15:00），观察日志：
```bash
pm2 logs quant-live-service
```

应该看到：
```
[Cron] Running scheduled check...
找到 1 个活跃账户
检查账户：xxx (600519)
开始检查账户 xxx
获取到 xxx 条分时数据，开始信号检测...
```

### 4. 手动触发测试（非交易时间）

如果需要立即测试，可以临时修改代码移除交易时间检查，或手动调用 API：
```bash
curl -X POST http://localhost:8889/api/accounts/27536f69-170f-4512-8324-c9e893d31868/run
```

## 备选方案：为现有账户添加策略快照

如果不想重启服务，可以直接在数据库中为现有账户添加策略快照：

```sql
-- 为 600519 账户添加默认策略快照
INSERT INTO quant_live_strategy_snapshots (account_id, strategy_id, strategy_name, strategy_config, effective_from)
VALUES (
  '27536f69-170f-4512-8324-c9e893d31868',
  'default',
  '默认策略',
  '{"name":"默认策略","signals":["macd_golden_cross","kdj_oversold"],"position":{"maxTotal":0.8,"maxSingle":0.3,"minCash":0.1},"risk":{"stopLoss":0.05,"takeProfit":0.15},"cost":{"commission":0.0003,"slippage":0.002}}',
  NOW()
);
```

## 后续优化建议

1. **前端集成策略选择**：创建账户时让用户选择策略
2. **策略快照管理**：添加策略更新/切换功能
3. **信号检测实现**：完善 `runAccountCheck` 中的信号检测逻辑
4. **自动交易执行**：实现信号触发后的自动买卖
5. **WebSocket 推送**：部署 HTTPS 后启用 WSS 推送实时数据
