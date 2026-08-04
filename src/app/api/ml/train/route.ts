import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getIndexKLineData } from '@/lib/tushare-client';
import { INDEX_DEFS } from '@/lib/ml/types';
import type { KLineData } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // 1. 读取配置
    const config = await request.json();
    const n_estimators = config.n_estimators ?? 100;
    const max_depth = config.max_depth ?? null;
    const min_samples_leaf = config.min_samples_leaf ?? 5;

    // 2. 从 Tushare 获取各指数 K 线数据
    const allData: Record<string, KLineData[]> = {};
    await Promise.all(
      INDEX_DEFS.map(async (idx) => {
        try {
          const data = await getIndexKLineData(idx.code);
          if (data && data.length > 60) {
            allData[idx.code] = data;
          }
        } catch (e) {
          console.warn(`[ml/train] 获取指数 ${idx.name}(${idx.code}) 数据失败:`, e);
        }
      })
    );

    const indexCount = Object.keys(allData).length;
    if (indexCount === 0) {
      return NextResponse.json(
        { success: false, error: '无法获取任何指数数据，请检查 Tushare Token 配置' },
        { status: 500 },
      );
    }

    // 3. 写入临时文件（原始 K 线数据，Python 脚本自行计算特征）
    const tmpFile = path.join(os.tmpdir(), `ml_train_${Date.now()}.json`);
    const dataToWrite = {
      index_defs: INDEX_DEFS,
      kline_data: allData,
      config: { n_estimators, max_depth, min_samples_leaf },
    };
    const jsonStr = JSON.stringify(dataToWrite);
    fs.writeFileSync(tmpFile, jsonStr, 'utf-8');

    // 4. 运行 Python 训练脚本
    const scriptPath = path.join(process.cwd(), 'src/lib/ml/train.py');
    const stdout = execSync(`python3 "${scriptPath}" "${tmpFile}"`, {
      timeout: 300_000,
      maxBuffer: 100 * 1024 * 1024,
    });

    // 5. 清理临时文件
    try { fs.unlinkSync(tmpFile); } catch {}

    // 6. 解析结果
    const result = JSON.parse(stdout.toString());
    return NextResponse.json(result);
  } catch (error: any) {
    const detail = error.stderr?.toString() || error.stdout?.toString() || error.message || error.status || '未知错误';
    const stack = error.stack?.split('\n').slice(0, 8).join('\n') || '';
    return NextResponse.json(
      { success: false, error: `训练失败: ${detail}`, stack },
      { status: 500 },
    );
  }
}