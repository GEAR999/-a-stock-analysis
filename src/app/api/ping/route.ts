import { NextResponse } from "next/server";

// GET: 存活探针（健康检查脚本专用，无业务数据，middleware 白名单）
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
