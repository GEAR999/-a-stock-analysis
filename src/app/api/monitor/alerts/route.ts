import { NextRequest, NextResponse } from 'next/server';
import { getAlertHistory, resolveAlert, addAlert } from '@/lib/alert-store';

// API 路由处理
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  
  const alerts = getAlertHistory(limit);
  
  return NextResponse.json({
    success: true,
    data: alerts,
    total: alerts.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, type, source, message } = body;
    
    if (action === 'resolve' && id) {
      const alert = resolveAlert(id);
      return NextResponse.json({ success: true, data: alert });
    }
    
    if (action === 'add' && type && source && message) {
      const alert = addAlert(type, source, message);
      return NextResponse.json({ success: true, data: alert });
    }
    
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 });
  }
}
