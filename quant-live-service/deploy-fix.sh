#!/bin/bash
# 量化实时服务修复脚本
# 在阿里云服务器网页终端中执行

echo "=========================================="
echo "量化实时服务 - 策略快照修复"
echo "=========================================="

# 1. 进入服务目录
cd /opt/quant-live-service
echo "✓ 进入服务目录"

# 2. 备份原文件
cp index.js index.js.bak.$(date +%Y%m%d_%H%M%S)
echo "✓ 已备份原文件"

# 3. 使用 Node.js 脚本修改代码（更安全）
node -e "
const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const oldCode = \`    if (req.body.strategy_config) {
      await sql\\\`
        INSERT INTO quant_live_strategy_snapshots (account_id, strategy_id, strategy_name, strategy_config, effective_from)
        VALUES (\\\${account[0].id}, \\\${req.body.strategy_id || 'default'}, \\\${req.body.strategy_name || null}, \\\${JSON.stringify(req.body.strategy_config)}, NOW())
      \\\`;
    }

    res.json({ success: true, data: account[0] });\`;

const newCode = \`    // 创建策略快照（如果没有提供，使用默认配置）
    const strategyConfig = req.body.strategy_config || {
      name: '默认策略',
      signals: ['macd_golden_cross', 'kdj_oversold'],
      position: { maxTotal: 0.8, maxSingle: 0.3, minCash: 0.1 },
      risk: { stopLoss: 0.05, takeProfit: 0.15 },
      cost: { commission: 0.0003, slippage: 0.002 }
    };
    
    await sql\\\`
      INSERT INTO quant_live_strategy_snapshots (account_id, strategy_id, strategy_name, strategy_config, effective_from)
      VALUES (\\\${account[0].id}, \\\${req.body.strategy_id || 'default'}, \\\${strategyConfig.name}, \\\${JSON.stringify(strategyConfig)}, NOW())
    \\\`;

    res.json({ success: true, data: account[0] });\`;

if (code.includes('if (req.body.strategy_config)')) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('index.js', code);
  console.log('✓ 代码修改成功');
} else {
  console.log(' 未找到目标代码，可能已修改过');
}
"

# 4. 重启服务
echo "重启服务..."
pm2 restart quant-live-service
echo "✓ 服务已重启"

# 5. 查看日志
echo ""
echo "=========================================="
echo "查看最新日志（按 Ctrl+C 退出）"
echo "=========================================="
pm2 logs quant-live-service --lines 30
