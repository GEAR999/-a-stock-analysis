import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getIndexKLineData } from '@/lib/tushare-client';
import { INDEX_DEFS, type TrainingSample } from '@/lib/ml/types';
import { combineAllIndices, timeSeriesSplit } from '@/lib/ml/data-preparation';
import type { KLineData } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // 1. 读取配置
    const config = await request.json();
    const n_estimators = config.n_estimators ?? 100;
    const max_depth = config.max_depth ?? null;
    const min_samples_leaf = config.min_samples_leaf ?? 5;

    // 2. 从 Tushare 获取各指数 K 线数据
    const allData = new Map<string, KLineData[]>();
    await Promise.all(
      INDEX_DEFS.map(async (idx) => {
        try {
          const data = await getIndexKLineData(idx.code);
          if (data && data.length > 60) {
            allData.set(idx.code, data);
          }
        } catch (e) {
          console.warn(`[ml/train] 获取指数 ${idx.name}(${idx.code}) 数据失败:`, e);
        }
      })
    );

    if (allData.size === 0) {
      return NextResponse.json(
        { success: false, error: '无法获取任何指数数据，请检查 Tushare Token 配置' },
        { status: 500 },
      );
    }

    // 3. 合并样本并切分
    const allSamples = combineAllIndices(allData);
    if (allSamples.length < 100) {
      return NextResponse.json(
        { success: false, error: `样本数不足: ${allSamples.length}（需要至少 100 个）` },
        { status: 500 },
      );
    }

    const { trainSamples, valSamples, testSamples } = timeSeriesSplit(allSamples);

    // 4. 获取每个指数的最新样本（用于当前预测）
    const latestFeatures: Record<string, number[]> = {};
    for (const idx of INDEX_DEFS) {
      const indexSamples = allSamples.filter(s => s.indexCode === idx.code);
      if (indexSamples.length > 0) {
        latestFeatures[idx.code] = indexSamples[indexSamples.length - 1].features;
      }
    }

    // 5. 格式化为 Python 脚本需要的结构
    const dataToWrite = {
      train: {
        features: trainSamples.map(s => s.features),
        labels: trainSamples.map(s => s.label),
        index_codes: trainSamples.map(s => s.indexCode),
        dates: trainSamples.map(s => s.date),
      },
      val: {
        features: valSamples.map(s => s.features),
        labels: valSamples.map(s => s.label),
        index_codes: valSamples.map(s => s.indexCode),
        dates: valSamples.map(s => s.date),
      },
      test: {
        features: testSamples.map(s => s.features),
        labels: testSamples.map(s => s.label),
        index_codes: testSamples.map(s => s.indexCode),
        dates: testSamples.map(s => s.date),
      },
      latest_features: latestFeatures,
      index_defs: INDEX_DEFS,
      config: { n_estimators, max_depth, min_samples_leaf },
    };

    // 6. 写入临时文件
    const tmpFile = path.join(os.tmpdir(), `ml_train_${Date.now()}.json`);
    const jsonStr = JSON.stringify(dataToWrite);
    fs.writeFileSync(tmpFile, jsonStr, 'utf-8');

    // 验证文件完整性
    const writtenSize = fs.statSync(tmpFile).size;
    const expectedSize = Buffer.byteLength(jsonStr, 'utf-8');
    if (writtenSize !== expectedSize) {
      // 如果写入不完整，等待 500ms 再试
      await new Promise(r => setTimeout(r, 500));
      const retrySize = fs.statSync(tmpFile).size;
      if (retrySize !== expectedSize) {
        // 尝试用流式写入
        const ws = fs.createWriteStream(tmpFile, { highWaterMark: 1024 * 1024 });
        await new Promise<void>((resolve, reject) => {
          ws.write(jsonStr, 'utf-8', (err) => {
            if (err) reject(err);
            else { ws.end(); resolve(); }
          });
        });
      }
    }

    // 7. 运行 Python 训练脚本
    const scriptPath = path.join(process.cwd(), 'src/lib/ml/train.py');
    const stdout = execSync(`python3 "${scriptPath}" "${tmpFile}"`, {
      timeout: 300_000, // 5 分钟
      maxBuffer: 100 * 1024 * 1024, // 100MB
    });

    // 8. 清理临时文件
    try { fs.unlinkSync(tmpFile); } catch {}

    // 9. 解析结果
    const result = JSON.parse(stdout.toString());
    return NextResponse.json(result);
  } catch (error: any) {
    const detail = error.stderr?.toString() || error.stdout?.toString() || error.message || error.status || '未知错误';
    return NextResponse.json(
      { success: false, error: `训练失败: ${detail}` },
      { status: 500 },
    );
  }
}