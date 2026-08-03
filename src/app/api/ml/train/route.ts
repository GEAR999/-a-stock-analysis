import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  const scriptPath = path.join(process.cwd(), 'src/lib/ml/train.py');

  // 启动 Python 进程
  const python = spawn('python3', [scriptPath], {
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

  // 将请求体直接管道到 Python 进程的 stdin
  // 避免大 JSON 在内存中二次序列化导致的截断问题
  const bodyStream = request.body;
  if (bodyStream) {
    try {
      await pipeline(
        Readable.fromWeb(bodyStream as any),
        python.stdin,
      );
    } catch (err: any) {
      // stdin 管道可能因 Python 进程提前退出而中断，忽略
    }
  } else {
    python.stdin.end();
  }

  // 等待 Python 进程完成
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      python.kill();
      resolve(
        NextResponse.json(
          { success: false, error: '训练超时（120秒）' },
          { status: 500 },
        ),
      );
    }, 120_000);

    python.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0 && !stdout) {
        resolve(
          NextResponse.json(
            { success: false, error: `训练失败: ${stderr || `进程退出码: ${code}`}` },
            { status: 500 },
          ),
        );
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(NextResponse.json(result));
      } catch (e: any) {
        resolve(
          NextResponse.json(
            { success: false, error: `结果解析失败: ${e.message}. stdout: ${stdout.slice(0, 500)}` },
            { status: 500 },
          ),
        );
      }
    });

    python.on('error', (err) => {
      clearTimeout(timeout);
      resolve(
        NextResponse.json(
          { success: false, error: `Python 进程错误: ${err.message}` },
          { status: 500 },
        ),
      );
    });
  });
}