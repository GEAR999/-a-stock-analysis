import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * 统一同步接口
 * POST /api/sync
 * 
 * 请求体：
 * {
 *   table: 'accounts' | 'transactions' | 'positions' | 'watchlist' | 'strategies' | 'backtest_sessions',
 *   action: 'create' | 'update' | 'delete',
 *   data: any
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, action, data } = body;

    if (!table || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing table or action' },
        { status: 400 }
      );
    }

    switch (table) {
      case 'accounts':
        await syncAccount(data, action);
        break;
      case 'transactions':
        await syncTransaction(data, action);
        break;
      case 'positions':
        await syncPosition(data, action);
        break;
      case 'watchlist':
        await syncWatchlist(data, action);
        break;
      case 'strategies':
        await syncStrategy(data, action);
        break;
      case 'backtest_sessions':
        await syncBacktestSession(data, action);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown table: ${table}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Sync] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed' },
      { status: 500 }
    );
  }
}

// 同步账户
async function syncAccount(data: any, action: string) {
  if (action === 'create' || action === 'update') {
    await query`
      INSERT INTO accounts (id, name, initial_capital, current_capital, created_at, updated_at)
      VALUES (${data.id}, ${data.name}, ${data.initial_capital}, ${data.current_capital}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        current_capital = EXCLUDED.current_capital,
        updated_at = NOW()
    `;
  } else if (action === 'delete') {
    await query`DELETE FROM accounts WHERE id = ${data.id}`;
  }
}

// 同步交易记录
async function syncTransaction(data: any, action: string) {
  if (action === 'create') {
    await query`
      INSERT INTO transactions (id, account_id, stock_code, stock_name, type, price, quantity, amount, created_at)
      VALUES (${data.id}, ${data.account_id}, ${data.stock_code}, ${data.stock_name}, ${data.type}, ${data.price}, ${data.quantity}, ${data.amount}, NOW())
    `;
  } else if (action === 'delete') {
    await query`DELETE FROM transactions WHERE id = ${data.id}`;
  }
}

// 同步持仓
async function syncPosition(data: any, action: string) {
  if (action === 'create' || action === 'update') {
    await query`
      INSERT INTO positions (id, account_id, stock_code, stock_name, quantity, avg_cost, current_price, market_value, profit, profit_rate, updated_at)
      VALUES (${data.id}, ${data.account_id}, ${data.stock_code}, ${data.stock_name}, ${data.quantity}, ${data.avg_cost}, ${data.current_price}, ${data.market_value}, ${data.profit}, ${data.profit_rate}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        avg_cost = EXCLUDED.avg_cost,
        current_price = EXCLUDED.current_price,
        market_value = EXCLUDED.market_value,
        profit = EXCLUDED.profit,
        profit_rate = EXCLUDED.profit_rate,
        updated_at = NOW()
    `;
  } else if (action === 'delete') {
    await query`DELETE FROM positions WHERE id = ${data.id}`;
  }
}

// 同步自选股
async function syncWatchlist(data: any, action: string) {
  if (action === 'create') {
    await query`
      INSERT INTO watchlist (id, stock_code, stock_name, created_at)
      VALUES (${data.id}, ${data.stock_code}, ${data.stock_name}, NOW())
    `;
  } else if (action === 'delete') {
    await query`DELETE FROM watchlist WHERE id = ${data.id}`;
  }
}

// 同步策略
async function syncStrategy(data: any, action: string) {
  if (action === 'create' || action === 'update') {
    await query`
      INSERT INTO strategies (id, name, description, config, is_builtin, created_at, updated_at)
      VALUES (${data.id}, ${data.name}, ${data.description}, ${JSON.stringify(data.config)}, ${data.is_builtin || false}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        updated_at = NOW()
    `;
  } else if (action === 'delete') {
    await query`DELETE FROM strategies WHERE id = ${data.id}`;
  }
}

// 同步回测会话
async function syncBacktestSession(data: any, action: string) {
  if (action === 'create' || action === 'update') {
    await query`
      INSERT INTO backtest_sessions (id, account_id, account_name, initial_capital, current_capital, total_return, max_drawdown, sharpe_ratio, win_rate, trade_count, config, results, status, saved_at)
      VALUES (${data.id}, ${data.account_id}, ${data.account_name}, ${data.initial_capital}, ${data.current_capital}, ${data.total_return}, ${data.max_drawdown}, ${data.sharpe_ratio}, ${data.win_rate}, ${data.trade_count}, ${JSON.stringify(data.config)}, ${JSON.stringify(data.results)}, ${data.status || 'saved'}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        account_name = EXCLUDED.account_name,
        current_capital = EXCLUDED.current_capital,
        total_return = EXCLUDED.total_return,
        max_drawdown = EXCLUDED.max_drawdown,
        sharpe_ratio = EXCLUDED.sharpe_ratio,
        win_rate = EXCLUDED.win_rate,
        trade_count = EXCLUDED.trade_count,
        config = EXCLUDED.config,
        results = EXCLUDED.results,
        status = EXCLUDED.status,
        saved_at = NOW(),
        updated_at = NOW()
    `;
  } else if (action === 'delete') {
    await query`DELETE FROM backtest_sessions WHERE id = ${data.id}`;
  }
}
