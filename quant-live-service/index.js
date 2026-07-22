// 量化实时账户服务 - 主入口
// 功能：WebSocket 推送 + HTTP API + Cron 定时任务

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cron = require('node-cron');
const { neon } = require('@neondatabase/serverless');
const axios = require('axios');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Neon 数据库连接
const sql = neon(process.env.DATABASE_URL);

// mootdx 服务地址
const MOOTDX_URL = process.env.MOOTDX_URL || 'http://47.122.115.203:8888';

// 存储连接的客户端
const clients = new Set();

// WebSocket 连接处理
wss.on('connection', (ws) => {
  console.log('客户端已连接');
  clients.add(ws);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'subscribe' && msg.accountId) {
        console.log(`客户端订阅账户：${msg.accountId}`);
        // 可以在这里添加账户特定的订阅逻辑
      }
    } catch (err) {
      console.error('WebSocket 消息解析错误:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('客户端已断开');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket 错误:', err.message);
    clients.delete(ws);
  });
});

// 广播消息到所有客户端
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// ============ HTTP API ============

// 获取账户列表
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await sql`
      SELECT * FROM quant_live_accounts 
      ORDER BY created_at DESC
    `;
    res.json({ success: true, data: accounts });
  } catch (err) {
    console.error('获取账户列表失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 创建账户
app.post('/api/accounts', async (req, res) => {
  try {
    const { name, stock_code, stock_name, initial_capital } = req.body;
    
    if (!name || !stock_code || !initial_capital) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const account = await sql`
      INSERT INTO quant_live_accounts (name, stock_code, stock_name, initial_capital, current_cash, status)
      VALUES (${name}, ${stock_code}, ${stock_name || null}, ${initial_capital}, ${initial_capital}, 'paused')
      RETURNING *
    `;

    // 创建初始策略快照（如果有策略配置）
    if (req.body.strategy_config) {
      await sql`
        INSERT INTO quant_live_strategy_snapshots (account_id, strategy_id, strategy_name, strategy_config, effective_from)
        VALUES (${account[0].id}, ${req.body.strategy_id || 'default'}, ${req.body.strategy_name || null}, ${JSON.stringify(req.body.strategy_config)}, NOW())
      `;
    }

    res.json({ success: true, data: account[0] });
  } catch (err) {
    console.error('创建账户失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取账户详情
app.get('/api/accounts/:id', async (req, res) => {
  try {
    const accounts = await sql`
      SELECT * FROM quant_live_accounts WHERE id = ${req.params.id}
    `;
    if (accounts.length === 0) {
      return res.status(404).json({ success: false, error: '账户不存在' });
    }
    res.json({ success: true, data: accounts[0] });
  } catch (err) {
    console.error('获取账户详情失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新账户状态
app.put('/api/accounts/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await sql`
      UPDATE quant_live_accounts SET status = ${status}, updated_at = NOW()
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error('更新账户失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取交易记录
app.get('/api/accounts/:id/trades', async (req, res) => {
  try {
    const trades = await sql`
      SELECT * FROM quant_live_trades 
      WHERE account_id = ${req.params.id}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    res.json({ success: true, data: trades });
  } catch (err) {
    console.error('获取交易记录失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取持仓
app.get('/api/accounts/:id/positions', async (req, res) => {
  try {
    const positions = await sql`
      SELECT * FROM quant_live_positions 
      WHERE account_id = ${req.params.id}
    `;
    res.json({ success: true, data: positions });
  } catch (err) {
    console.error('获取持仓失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 手动触发一次检查
app.post('/api/accounts/:id/run', async (req, res) => {
  try {
    await runAccountCheck(req.params.id);
    res.json({ success: true, message: '检查完成' });
  } catch (err) {
    console.error('执行检查失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 核心逻辑 ============

// 获取分时数据
async function getMinuteData(stockCode) {
  try {
    const response = await axios.get(`${MOOTDX_URL}/api/minute`, {
      params: { code: stockCode },
      timeout: 5000
    });
    return response.data.data || [];
  } catch (err) {
    console.error('获取分时数据失败:', err.message);
    return [];
  }
}

// 检查是否是交易时间
function isTradingTime() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 60 + minute;

  // 周末不交易
  if (day === 0 || day === 6) return false;

  // 上午 9:30-11:30
  if (time >= 570 && time < 690) return true;

  // 下午 13:00-15:00
  if (time >= 780 && time < 900) return true;

  return false;
}

// 执行账户检查
async function runAccountCheck(accountId) {
  console.log(`[${new Date().toISOString()}] 开始检查账户 ${accountId}`);

  // 获取账户信息
  const accounts = await sql`SELECT * FROM quant_live_accounts WHERE id = ${accountId}`;
  if (accounts.length === 0) {
    console.log('账户不存在');
    return;
  }
  const account = accounts[0];

  if (account.status !== 'active') {
    console.log('账户未激活，跳过');
    return;
  }

  // 获取当前生效的策略快照
  const snapshots = await sql`
    SELECT * FROM quant_live_strategy_snapshots 
    WHERE account_id = ${accountId} 
    AND effective_from <= NOW() 
    AND (effective_to IS NULL OR effective_to > NOW())
    ORDER BY effective_from DESC
    LIMIT 1
  `;

  if (snapshots.length === 0) {
    console.log('无有效策略，跳过');
    return;
  }

  const strategy = snapshots[0];
  const strategyConfig = strategy.strategy_config;

  // 获取分时数据
  const minuteData = await getMinuteData(account.stock_code);
  if (minuteData.length === 0) {
    console.log('无分时数据，跳过');
    return;
  }

  // TODO: 信号检测逻辑（需要复用前端的 generateSignals）
  // 这里简化处理，实际应该调用信号检测函数
  console.log(`获取到 ${minuteData.length} 条分时数据`);

  // 广播给所有客户端
  broadcast({
    type: 'check',
    accountId: accountId,
    timestamp: new Date().toISOString(),
    dataPoints: minuteData.length
  });
}

// ============ Cron 定时任务 ============

// 每 1 分钟执行一次（交易时间内）
cron.schedule('* * * * *', async () => {
  if (!isTradingTime()) {
    return;
  }

  console.log(`[${new Date().toISOString()}] 定时任务触发`);

  try {
    // 获取所有活跃账户
    const accounts = await sql`
      SELECT id FROM quant_live_accounts WHERE status = 'active'
    `;

    for (const account of accounts) {
      await runAccountCheck(account.id);
    }
  } catch (err) {
    console.error('定时任务执行失败:', err);
  }
});

// ============ 启动服务 ============

const PORT = process.env.PORT || 8889;

server.listen(PORT, () => {
  console.log(`量化实时服务已启动`);
  console.log(`WebSocket: ws://0.0.0.0:${PORT}`);
  console.log(`HTTP API: http://0.0.0.0:${PORT}/api`);
  console.log(`mootdx: ${MOOTDX_URL}`);
});
