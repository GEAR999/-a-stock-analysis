import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// GET /api/strategies - 获取所有策略（系统默认+用户自定义）
export async function GET() {
  try {
    const strategies = await query`
      SELECT * FROM strategy_templates ORDER BY is_builtin DESC, name
    `;

    return NextResponse.json({ success: true, data: strategies });
  } catch (error) {
    console.error('Failed to fetch strategies:', error);
    return NextResponse.json(
      { success: false, error: '获取策略列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/strategies - 创建自定义策略
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, theories, confidence, params } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: '缺少策略名称' },
        { status: 400 }
      );
    }

    const result = await query`
      INSERT INTO strategy_templates (name, description, theories, confidence, params, is_builtin)
      VALUES (${name}, ${description || ''}, ${JSON.stringify(theories || [])}, ${confidence || 50}, ${JSON.stringify(params || {})}, false)
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Failed to create strategy:', error);
    return NextResponse.json(
      { success: false, error: '创建策略失败' },
      { status: 500 }
    );
  }
}

// PUT /api/strategies - 更新策略
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, theories, confidence, params } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少策略ID' },
        { status: 400 }
      );
    }

    const result = await query`
      UPDATE strategy_templates SET 
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        theories = COALESCE(${theories ? JSON.stringify(theories) : null}, theories),
        confidence = COALESCE(${confidence}, confidence),
        params = COALESCE(${params ? JSON.stringify(params) : null}, params),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Failed to update strategy:', error);
    return NextResponse.json(
      { success: false, error: '更新策略失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/strategies - 删除自定义策略
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少策略ID' },
        { status: 400 }
      );
    }

    // 检查是否为内置策略
    const strategy = await query`
      SELECT * FROM strategy_templates WHERE id = ${id}
    `;
    if (strategy.length === 0) {
      return NextResponse.json({ success: false, error: '策略不存在' }, { status: 404 });
    }
    if (strategy[0].is_builtin) {
      return NextResponse.json({ success: false, error: '内置策略不可删除' }, { status: 400 });
    }

    await execute`
      DELETE FROM strategy_templates WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete strategy:', error);
    return NextResponse.json(
      { success: false, error: '删除策略失败' },
      { status: 500 }
    );
  }
}
