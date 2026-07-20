// 历史信号存储 - IndexedDB

const DB_NAME = "stock_signals";
const STORE_NAME = "analysis_snapshots";
const DB_VERSION = 1;

export interface SignalSnapshot {
  id?: number;
  stockCode: string;
  stockName: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  signals: SignalItem[];
  score: number; // -100 to 100
  conclusion: string;
  klineIndex: number; // 对应K线数据的索引
}

export interface SignalItem {
  type: "buy" | "sell" | "neutral";
  source: string; // "chanlun" | "wave" | "technical" | "macd" | "kdj" | "rsi" | "boll"
  description: string;
  strength: number; // 1-5
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("stockCode", "stockCode", { unique: false });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("stockDate", ["stockCode", "date"], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSignalSnapshot(snapshot: Omit<SignalSnapshot, "id">): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(snapshot);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getSignalsByStock(stockCode: string, limit = 100): Promise<SignalSnapshot[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("stockCode");
    const request = index.getAll(stockCode);
    request.onsuccess = () => {
      const results = (request.result as SignalSnapshot[])
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSignalSnapshot(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearSignalsByStock(stockCode: string): Promise<void> {
  const db = await openDB();
  const signals = await getSignalsByStock(stockCode, 10000);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let completed = 0;
    if (signals.length === 0) { resolve(); return; }
    signals.forEach(s => {
      const req = store.delete(s.id!);
      req.onsuccess = () => { completed++; if (completed >= signals.length) resolve(); };
      req.onerror = () => reject(req.error);
    });
  });
}

// 计算信号准确率（30天后涨跌统计）
export async function calculateAccuracy(stockCode: string, klineData: { date: string; close: number }[]): Promise<{ total: number; correct: number; accuracy: number }> {
  const signals = await getSignalsByStock(stockCode, 1000);
  let total = 0;
  let correct = 0;

  for (const snapshot of signals) {
    const buySignals = snapshot.signals.filter(s => s.type === "buy");
    const sellSignals = snapshot.signals.filter(s => s.type === "sell");
    
    if (buySignals.length === 0 && sellSignals.length === 0) continue;

    // 找到30天后的价格
    const signalIdx = klineData.findIndex(k => k.date === snapshot.date);
    if (signalIdx < 0 || signalIdx + 30 >= klineData.length) continue;

    const futurePrice = klineData[signalIdx + 30].close;
    const currentPrice = klineData[signalIdx].close;
    const went_up = futurePrice > currentPrice;

    total++;
    if (buySignals.length > sellSignals.length && went_up) correct++;
    if (sellSignals.length > buySignals.length && !went_up) correct++;
  }

  return {
    total,
    correct,
    accuracy: total > 0 ? (correct / total) * 100 : 0,
  };
}
