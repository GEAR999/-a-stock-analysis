// 分析报告导出工具

export interface ReportData {
  stockCode: string;
  stockName: string;
  analysisTime: string;
  currentPrice: number;
  changePercent: number;
  indicators: {
    macd: { dif: number; dea: number; histogram: number; signal: string };
    kdj: { k: number; d: number; j: number; signal: string };
    rsi: number;
    boll: { upper: number; middle: number; lower: number; position: string };
  };
  chanlun: {
    currentStage: string;
    buySignals: Array<{ type: number; index: number; price: number }>;
    sellSignals: Array<{ type: number; index: number; price: number }>;
  };
  wave: {
    currentWave: string;
    waves: Array<{ label: string; start: number; end: number }>;
  };
  advice: {
    score: number;
    overall: string;
    details: string[];
    risk: string[];
  };
  moneyFlow?: {
    todayMainNetInflow: number;
    rating: string;
  };
  fundamental?: {
    pe: number;
    pb: number;
    roe: number;
    rating: string;
  };
}

// 生成文本报告
export function generateTextReport(data: ReportData): string {
  const lines: string[] = [];

  // 标题
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('                    A股智析系统');
  lines.push('                    分析报告');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');

  // 基本信息
  lines.push(`【股票信息】`);
  lines.push(`  股票: ${data.stockName} (${data.stockCode})`);
  lines.push(`  分析时间: ${data.analysisTime}`);
  lines.push(`  当前价格: ${data.currentPrice.toFixed(2)} 元`);
  lines.push(`  涨跌幅: ${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%`);
  lines.push('');

  // 技术指标
  lines.push('【技术指标】');
  lines.push(`  MACD: DIF=${data.indicators.macd.dif.toFixed(3)}, DEA=${data.indicators.macd.dea.toFixed(3)}, 柱状=${data.indicators.macd.histogram.toFixed(3)}`);
  lines.push(`    信号: ${data.indicators.macd.signal}`);
  lines.push(`  KDJ: K=${data.indicators.kdj.k.toFixed(2)}, D=${data.indicators.kdj.d.toFixed(2)}, J=${data.indicators.kdj.j.toFixed(2)}`);
  lines.push(`    信号: ${data.indicators.kdj.signal}`);
  lines.push(`  RSI: ${data.indicators.rsi.toFixed(2)}`);
  lines.push(`  BOLL: 上轨=${data.indicators.boll.upper.toFixed(2)}, 中轨=${data.indicators.boll.middle.toFixed(2)}, 下轨=${data.indicators.boll.lower.toFixed(2)}`);
  lines.push(`    位置: ${data.indicators.boll.position}`);
  lines.push('');

  // 缠论分析
  lines.push('【缠论分析】');
  lines.push(`  当前阶段: ${data.chanlun.currentStage}`);
  if (data.chanlun.buySignals.length > 0) {
    const lastBuy = data.chanlun.buySignals[data.chanlun.buySignals.length - 1];
    lines.push(`  最近买点: ${lastBuy.type}买点 @ ${lastBuy.price.toFixed(2)}`);
  }
  if (data.chanlun.sellSignals.length > 0) {
    const lastSell = data.chanlun.sellSignals[data.chanlun.sellSignals.length - 1];
    lines.push(`  最近卖点: ${lastSell.type}卖点 @ ${lastSell.price.toFixed(2)}`);
  }
  lines.push('');

  // 波浪分析
  lines.push('【波浪分析】');
  lines.push(`  当前浪位: ${data.wave.currentWave}`);
  lines.push('');

  // 综合评分
  lines.push('【综合评分】');
  lines.push(`  评分: ${data.advice.score} / 100`);
  lines.push(`  建议: ${data.advice.overall}`);
  if (data.advice.details.length > 0) {
    lines.push('  分析要点:');
    data.advice.details.forEach(d => lines.push(`    - ${d}`));
  }
  if (data.advice.risk.length > 0) {
    lines.push('  风险提示:');
    data.advice.risk.forEach(r => lines.push(`    - ${r}`));
  }
  lines.push('');

  // 资金流向（如有）
  if (data.moneyFlow) {
    lines.push('【资金流向】');
    lines.push(`  今日主力净流入: ${(data.moneyFlow.todayMainNetInflow / 10000).toFixed(2)} 万元`);
    lines.push(`  评级: ${data.moneyFlow.rating}`);
    lines.push('');
  }

  // 基本面（如有）
  if (data.fundamental) {
    lines.push('【基本面】');
    lines.push(`  PE(市盈率): ${data.fundamental.pe.toFixed(2)}`);
    lines.push(`  PB(市净率): ${data.fundamental.pb.toFixed(2)}`);
    lines.push(`  ROE: ${(data.fundamental.roe * 100).toFixed(2)}%`);
    lines.push(`  评级: ${data.fundamental.rating}`);
    lines.push('');
  }

  // 免责声明
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('  免责声明: 以上分析仅供参考，不构成投资建议。');
  lines.push('  投资有风险，入市需谨慎。');
  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}

// 导出文本报告
export function exportTextReport(data: ReportData): void {
  const content = generateTextReport(data);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${data.stockName}_${data.stockCode}_分析报告.txt`);
}

// 导出为HTML（用于截图）
export function generateReportHTML(data: ReportData): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0e17;
      color: #e2e8f0;
      padding: 24px;
      min-width: 600px;
    }
    .header {
      text-align: center;
      padding-bottom: 16px;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 20px;
      color: #3b82f6;
      margin-bottom: 4px;
    }
    .header .subtitle {
      font-size: 12px;
      color: #94a3b8;
    }
    .section {
      margin-bottom: 16px;
      padding: 12px;
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 4px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #3b82f6;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #1e293b;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
    }
    .label { color: #94a3b8; }
    .value { color: #e2e8f0; font-family: monospace; }
    .up { color: #ef4444; }
    .down { color: #22c55e; }
    .neutral { color: #94a3b8; }
    .score {
      text-align: center;
      padding: 12px;
    }
    .score-value {
      font-size: 36px;
      font-weight: bold;
    }
    .score-label {
      font-size: 14px;
      margin-top: 4px;
    }
    .detail-list {
      list-style: none;
      padding: 0;
    }
    .detail-list li {
      font-size: 11px;
      color: #94a3b8;
      padding: 2px 0;
      padding-left: 12px;
      position: relative;
    }
    .detail-list li:before {
      content: '•';
      position: absolute;
      left: 0;
      color: #3b82f6;
    }
    .footer {
      text-align: center;
      padding-top: 16px;
      border-top: 1px solid #1e293b;
      margin-top: 20px;
    }
    .footer p {
      font-size: 10px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>A股智析系统</h1>
    <div class="subtitle">分析报告 | ${data.analysisTime}</div>
  </div>

  <div class="section">
    <div class="section-title">股票信息</div>
    <div class="row">
      <span class="label">股票</span>
      <span class="value">${data.stockName} (${data.stockCode})</span>
    </div>
    <div class="row">
      <span class="label">当前价格</span>
      <span class="value">${data.currentPrice.toFixed(2)} 元</span>
    </div>
    <div class="row">
      <span class="label">涨跌幅</span>
      <span class="value ${data.changePercent >= 0 ? 'up' : 'down'}">${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">技术指标</div>
    <div class="row">
      <span class="label">MACD</span>
      <span class="value">${data.indicators.macd.signal}</span>
    </div>
    <div class="row">
      <span class="label">KDJ</span>
      <span class="value">${data.indicators.kdj.signal}</span>
    </div>
    <div class="row">
      <span class="label">RSI</span>
      <span class="value">${data.indicators.rsi.toFixed(2)}</span>
    </div>
    <div class="row">
      <span class="label">BOLL位置</span>
      <span class="value">${data.indicators.boll.position}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">缠论分析</div>
    <div class="row">
      <span class="label">当前阶段</span>
      <span class="value">${data.chanlun.currentStage}</span>
    </div>
    ${data.chanlun.buySignals.length > 0 ? `
    <div class="row">
      <span class="label">最近买点</span>
      <span class="value up">${data.chanlun.buySignals[data.chanlun.buySignals.length - 1].type}买点</span>
    </div>` : ''}
    ${data.chanlun.sellSignals.length > 0 ? `
    <div class="row">
      <span class="label">最近卖点</span>
      <span class="value down">${data.chanlun.sellSignals[data.chanlun.sellSignals.length - 1].type}卖点</span>
    </div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">波浪分析</div>
    <div class="row">
      <span class="label">当前浪位</span>
      <span class="value">${data.wave.currentWave}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">综合评分</div>
    <div class="score">
      <div class="score-value ${data.advice.score >= 60 ? 'up' : data.advice.score <= 40 ? 'down' : 'neutral'}">${data.advice.score}</div>
      <div class="score-label ${data.advice.overall === '看多' ? 'up' : data.advice.overall === '看空' ? 'down' : 'neutral'}">${data.advice.overall}</div>
    </div>
    ${data.advice.details.length > 0 ? `
    <ul class="detail-list">
      ${data.advice.details.map(d => `<li>${d}</li>`).join('')}
    </ul>` : ''}
  </div>

  ${data.moneyFlow ? `
  <div class="section">
    <div class="section-title">资金流向</div>
    <div class="row">
      <span class="label">今日主力净流入</span>
      <span class="value ${data.moneyFlow.todayMainNetInflow >= 0 ? 'up' : 'down'}">${(data.moneyFlow.todayMainNetInflow / 10000).toFixed(2)} 万元</span>
    </div>
    <div class="row">
      <span class="label">评级</span>
      <span class="value">${data.moneyFlow.rating}</span>
    </div>
  </div>` : ''}

  ${data.fundamental ? `
  <div class="section">
    <div class="section-title">基本面</div>
    <div class="row">
      <span class="label">PE(市盈率)</span>
      <span class="value">${data.fundamental.pe.toFixed(2)}</span>
    </div>
    <div class="row">
      <span class="label">PB(市净率)</span>
      <span class="value">${data.fundamental.pb.toFixed(2)}</span>
    </div>
    <div class="row">
      <span class="label">ROE</span>
      <span class="value">${(data.fundamental.roe * 100).toFixed(2)}%</span>
    </div>
    <div class="row">
      <span class="label">评级</span>
      <span class="value">${data.fundamental.rating}</span>
    </div>
  </div>` : ''}

  <div class="footer">
    <p>免责声明: 以上分析仅供参考，不构成投资建议。投资有风险，入市需谨慎。</p>
    <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  </div>
</body>
</html>`;
}

// 下载Blob
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 导出PNG（需要html2canvas）
export async function exportPNG(data: ReportData): Promise<void> {
  try {
    // 动态导入html2canvas
    const html2canvas = (await import('html2canvas')).default;

    // 创建临时容器
    const container = document.createElement('div');
    container.innerHTML = generateReportHTML(data);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    // 截图
    const canvas = await html2canvas(container, {
      backgroundColor: '#0a0e17',
      scale: 2,
    });

    // 清理
    document.body.removeChild(container);

    // 下载
    canvas.toBlob((blob: Blob | null) => {
      if (blob) {
        downloadBlob(blob, `${data.stockName}_${data.stockCode}_分析报告.png`);
      }
    }, 'image/png');
  } catch (e) {
    console.error('导出PNG失败:', e);
    alert('导出PNG失败，请确保已安装html2canvas');
  }
}

// 导出PDF（需要jsPDF + html2canvas）
export async function exportPDF(data: ReportData): Promise<void> {
  try {
    const [html2canvasModule, jsPDFModule] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const html2canvas = html2canvasModule.default;
    const { jsPDF } = jsPDFModule;

    // 创建临时容器
    const container = document.createElement('div');
    container.innerHTML = generateReportHTML(data);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '600px';
    document.body.appendChild(container);

    // 截图
    const canvas = await html2canvas(container, {
      backgroundColor: '#0a0e17',
      scale: 2,
    });

    // 清理
    document.body.removeChild(container);

    // 生成PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${data.stockName}_${data.stockCode}_分析报告.pdf`);
  } catch (e) {
    console.error('导出PDF失败:', e);
    alert('导出PDF失败，请确保已安装jspdf和html2canvas');
  }
}
