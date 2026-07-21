import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/strategies - 获取所有策略模板
export async function GET() {
  try {
    const strategies = await query`
      SELECT * FROM strategy_templates ORDER BY is_default DESC, name
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

// POST /api/strategies - 创建策略模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, description, config, is_default } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: '缺少策略名称' },
        { status: 400 }
      );
    }

    const result = await query`
      INSERT INTO strategy_templates (user_id, name, description, config, is_default)
      VALUES (${user_id || null}, ${name}, ${description || ''}, ${JSON.stringify(config || {})}, ${is_default || false})
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

// PUT /api/strategies - 更新策略模板
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, config, is_default } = body;

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
        config = COALESCE(${config ? JSON.stringify(config) : null}, config),
        is_default = COALESCE(${is_default}, is_default),
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

// DELETE /api/strategies - 删除策略模板
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

    await query`DELETE FROM strategy_templates WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete strategy:', error);
    return NextResponse.json(
      { success: false, error: '删除策略失败' },
      { status: 500 }
    );
  }
}
