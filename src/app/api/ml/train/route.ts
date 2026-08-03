import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证数据
    if (!body.train || !body.train.features || body.train.features.length < 10) {
      return NextResponse.json(
        { success: false, error: '训练数据不足（至少需要10条样本）' },
        { status: 400 },
      );
    }

    // 写入临时文件
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `ml_train_${Date.now()}.json`);
    const scriptPath = path.join(process.cwd(), 'src/lib/ml/train.py');

    fs.writeFileSync(tmpFile, JSON.stringify(body), 'utf-8');

    // 运行 Python 训练脚本（超时 120 秒）
    const stdout = execSync(`python3 "${scriptPath}" < "${tmpFile}"`, {
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });

    // 清理临时文件
    try { fs.unlinkSync(tmpFile); } catch {}

    const result = JSON.parse(stdout.toString('utf-8'));
    return NextResponse.json(result);
  } catch (error: any) {
    // 清理临时文件
    try {
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `ml_train_${Date.now()}.json`);
      fs.unlinkSync(tmpFile);
    } catch {}

    return NextResponse.json(
      { success: false, error: `训练失败: ${error.message || '未知错误'}` },
      { status: 500 },
    );
  }
}