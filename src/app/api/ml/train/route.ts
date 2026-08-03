import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
  const scriptPath = path.join(process.cwd(), 'src', 'lib', 'ml', 'train.py');

  const python = spawn('python3', [scriptPath]);

  let stdout = '';
  let stderr = '';

  python.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
  python.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

  // 从 request.body 逐块读取并写入 Python stdin
  const bodyStream = request.body;
  if (bodyStream) {
    const reader = bodyStream.getReader();
    const writer = python.stdin;

    // 异步管道：读取一个块 → 写入 → 等待 drain（背压控制）
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!writer.write(value)) {
            await new Promise<void>((resolve) => writer.once('drain', resolve));
          }
        }
        writer.end();
      } catch (err) {
        console.error('stdin pipe error:', err);
        python.kill();
      }
    })();
  } else {
    python.stdin.end();
  }

  // 等待 Python 进程结束
  return new Promise<NextResponse>((resolve) => {
    const timeout = setTimeout(() => {
      python.kill();
      resolve(
        NextResponse.json(
          { success: false, error: '训练超时' },
          { status: 500 },
        ),
      );
    }, 120_000);

    python.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0 && stdout) {
        try {
          const result = JSON.parse(stdout);
          resolve(NextResponse.json(result));
        } catch (e: any) {
          resolve(
            NextResponse.json(
              { success: false, error: `结果解析失败: ${e.message}` },
              { status: 500 },
            ),
          );
        }
      } else {
        resolve(
          NextResponse.json(
            { success: false, error: `训练失败: ${stderr || `退出码 ${code}`}` },
            { status: 500 },
          ),
        );
      }
    });

    python.on('error', (err) => {
      clearTimeout(timeout);
      resolve(
        NextResponse.json(
          { success: false, error: `进程错误: ${err.message}` },
          { status: 500 },
        ),
      );
    });
  });
}