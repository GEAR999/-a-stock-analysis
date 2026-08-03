import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

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

    const scriptPath = path.join(process.cwd(), 'src/lib/ml/train.py');

    // 使用 spawn 通过 stdin 传递数据，避免大文件写入截断问题
    const result = await new Promise<string>((resolve, reject) => {
      const python = spawn('python3', [scriptPath], {
        timeout: 120_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      python.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      python.on('error', (err) => {
        reject(err);
      });

      python.on('close', (code) => {
        if (code === 0 && stdout) {
          resolve(stdout);
        } else if (stdout) {
          // 尝试解析 stdout 看是否有错误信息
          resolve(stdout);
        } else {
          reject(new Error(stderr || `进程退出码: ${code}`));
        }
      });

      // 通过 stdin 发送数据
      const jsonStr = JSON.stringify(body);
      python.stdin.write(jsonStr, 'utf-8');
      python.stdin.end();
    });

    const parsed = JSON.parse(result);
    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `训练失败: ${error.message || '未知错误'}` },
      { status: 500 },
    );
  }
}