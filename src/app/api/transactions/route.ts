import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// POST /api/transactions - 记录交易（买入/卖出）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account_id, stock_code, stock_name, type, price, quantity, amount, fee, strategy_signals, note } = body;

    if (!account_id || !stock_code || !type || !price || !quantity) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 获取账户信息
    const accounts = await query`
      SELECT * FROM accounts WHERE id = ${account_id}
    `;
    if (accounts.length === 0) {
      return NextResponse.json({ success: false, error: '账户不存在' }, { status: 404 });
    }
    const account = accounts[0];
    const currentCapital = Number(account.current_capital);

    // 开始事务
    await execute`BEGIN`;

    try {
      if (type === 'buy') {
        const totalCost = Number(amount) + Number(fee || 0);
        if (totalCost > currentCapital) {
          await execute`ROLLBACK`;
          return NextResponse.json({ success: false, error: '资金不足' }, { status: 400 });
        }

        // 更新账户余额
        await execute`
          UPDATE accounts SET current_capital = current_capital - ${totalCost}, updated_at = NOW() WHERE id = ${account_id}
        `;

        // 更新或创建持仓
        const existingPositions = await query`
          SELECT * FROM positions WHERE account_id = ${account_id} AND stock_code = ${stock_code} AND quantity > 0
        `;

        if (existingPositions.length > 0) {
          const pos = existingPositions[0];
          const oldQty = Number(pos.quantity);
          const oldCost = Number(pos.avg_cost);
          const newQty = oldQty + Number(quantity);
          const newCost = (oldCost * oldQty + Number(price) * Number(quantity)) / newQty;
          await execute`
            UPDATE positions SET quantity = ${newQty}, avg_cost = ${newCost}, updated_at = NOW()
            WHERE account_id = ${account_id} AND stock_code = ${stock_code}
          `;
        } else {
          await execute`
            INSERT INTO positions (account_id, stock_code, stock_name, quantity, avg_cost, open_date)
            VALUES (${account_id}, ${stock_code}, ${stock_name || ''}, ${quantity}, ${price}, CURRENT_DATE)
          `;
        }
      } else if (type === 'sell') {
        const positions = await query`
          SELECT * FROM positions WHERE account_id = ${account_id} AND stock_code = ${stock_code} AND quantity > 0
        `;
        if (positions.length === 0 || Number(positions[0].quantity) < Number(quantity)) {
          await execute`ROLLBACK`;
          return NextResponse.json({ success: false, error: '持仓不足' }, { status: 400 });
        }

        const pos = positions[0];
        const newQty = Number(pos.quantity) - Number(quantity);
        if (newQty === 0) {
          await execute`
            UPDATE positions SET quantity = 0, updated_at = NOW()
            WHERE account_id = ${account_id} AND stock_code = ${stock_code}
          `;
        } else {
          await execute`
            UPDATE positions SET quantity = ${newQty}, updated_at = NOW()
            WHERE account_id = ${account_id} AND stock_code = ${stock_code}
          `;
        }

        const proceeds = Number(amount) - Number(fee || 0);
        await execute`
          UPDATE accounts SET current_capital = current_capital + ${proceeds}, updated_at = NOW() WHERE id = ${account_id}
        `;
      }

      // 记录交易
      const result = await query`
        INSERT INTO transactions (account_id, stock_code, stock_name, type, price, quantity, amount, fee, strategy_signals, note)
        VALUES (${account_id}, ${stock_code}, ${stock_name || ''}, ${type}, ${price}, ${quantity}, ${amount}, ${fee || 0}, ${strategy_signals ? JSON.stringify(strategy_signals) : '{}'}, ${note || null})
        RETURNING *
      `;

      await execute`COMMIT`;
      return NextResponse.json({ success: true, data: result[0] });
    } catch (err) {
      await execute`ROLLBACK`;
      throw err;
    }
  } catch (error) {
    console.error('Failed to create transaction:', error);
    return NextResponse.json(
      { success: false, error: '记录交易失败' },
      { status: 500 }
    );
  }
}

// GET /api/transactions - 获取交易记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const stockCode = searchParams.get('stockCode');
    const limit = searchParams.get('limit') || '100';
    const offset = searchParams.get('offset') || '0';

    let result;
    // UUID 格式校验
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validAccountId = accountId && uuidRegex.test(accountId) ? accountId : null;
    
    if (validAccountId && stockCode) {
      result = await query`
        SELECT * FROM transactions 
        WHERE account_id = ${validAccountId} AND stock_code = ${stockCode}
        ORDER BY traded_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else if (validAccountId) {
      result = await query`
        SELECT * FROM transactions 
        WHERE account_id = ${validAccountId}
        ORDER BY traded_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else {
      result = await query`
        SELECT * FROM transactions 
        ORDER BY traded_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json(
      { success: false, error: '获取交易记录失败' },
      { status: 500 }
    );
  }
}
