import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function POST(request: NextRequest) {
  try {
    // 1. 读取完整请求体文本
    const bodyText = await request.text();
    if (!bodyText || bodyText.length < 100) {
      return NextResponse.json(
        { success: false, error: '请求体为空或数据不足' },
        { status: 400 },
      );
    }

    // 2. 写入临时文件
    const tmpFile = path.join(os.tmpdir(), `ml_train_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, bodyText, 'utf-8');

    // 3. 验证文件写入完整性
    const writtenSize = fs.statSync(tmpFile).size;
    const expectedSize = Buffer.byteLength(bodyText, 'utf-8');
    if (writtenSize !== expectedSize) {
      return NextResponse.json(
        { success: false, error: `文件写入不完整: ${writtenSize}/${expectedSize}` },
        { status: 500 },
      );
    }

    // 4. 运行 Python 训练脚本
    const scriptPath = path.join(process.cwd(), 'src/lib/ml/train.py');
    const stdout = execSync(`python3 "${scriptPath}" "${tmpFile}"`, {
      timeout: 180_000,
      maxBuffer: 100 * 1024 * 1024, // 100MB
    });

    // 5. 清理临时文件
    try { fs.unlinkSync(tmpFile); } catch {}

    // 6. 解析结果
    const result = JSON.parse(stdout.toString());
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `训练失败: ${error.message || '未知错误'}` },
      { status: 500 },
    );
  }
}