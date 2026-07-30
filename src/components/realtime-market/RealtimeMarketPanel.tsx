'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { fetchWithRetry } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface IndexQuote {
  price: number;
  change_pct: number;
}

interface MarketStats {
  advance_count: number;
  decline_count: number;
  limit_up: number;
  limit_down: number;
  total_volume: number;
}

interface WatchlistItem {
  code: string;
  name: string;
  price?: number;
  change_pct?: number;
}

interface WatchlistData {
  etf?: WatchlistItem[];
  stock?: WatchlistItem[];
}

interface MarketParamsRecord {
  id: number;
  timestamp: string;
  sh_price?: number;
  sh_change_pct?: number;
  sz_price?: number;
  sz_change_pct?: number;
  cyb_price?: number;
  cyb_change_pct?: number;
  advance_count?: number;
  decline_count?: number;
  limit_up?: number;
  limit_down?: number;
  total_volume?: number;
  watchlist_data?: WatchlistData | null;
  created_at: string;
}

interface MarketParamsResponse {
  success: boolean;
  data: {
    latest: MarketParamsRecord | null;
    history: MarketParamsRecord[];
  };
  error?: string;
}

interface MarketParamsConfig {
  id: number;
  watchlist_etf: WatchlistItem[];
  watchlist_stock: WatchlistItem[];
  push_times: string[];
  update_interval: number;
  data_retention_days: number;
  is_active: boolean;
  push_token_configured?: boolean;
  push_token_hint?: string | null;
}

interface ConfigResponse {
  success: boolean;
  data: MarketParamsConfig;
  error?: string;
  message?: string;
}

const DEFAULT_ETF_OPTIONS: WatchlistItem[] = [
  { code: 'sh513120', name: '港股创新药ETF' },
  { code: 'sh513330', name: '恒生互联网ETF' },
  { code: 'sz159516', name: '半导体设备ETF' },
];

const DEFAULT_STOCK_OPTIONS: WatchlistItem[] = [
  { code: 'sz300308', name: '中际旭创' },
  { code: 'hk09988', name: '阿里巴巴' },
];

function toNum(value?: number | string | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isNaN(n) ? undefined : n;
}

function formatNumber(value?: number | string | null, fractionDigits = 2) {
  const n = toNum(value);
  if (n === undefined) return '--';
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatTime(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function changeClass(value?: number | string | null) {
  const n = toNum(value);
  if (n === undefined) return 'text-slate-300';
  if (n > 0) return 'text-red-400';
  if (n < 0) return 'text-green-400';
  return 'text-slate-300';
}

function changeText(value?: number | string | null) {
  const n = toNum(value);
  if (n === undefined) return '--';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: MarketParamsConfig | null;
  onSaved: () => void;
}

interface ConfigFormState {
  watchlistEtf: WatchlistItem[];
  watchlistStock: WatchlistItem[];
  pushTimes: string[];
  updateInterval: string;
  dataRetentionDays: string;
}

const DEFAULT_CONFIG_FORM: ConfigFormState = {
  watchlistEtf: DEFAULT_ETF_OPTIONS,
  watchlistStock: DEFAULT_STOCK_OPTIONS,
  pushTimes: ['09:35', '10:00', '10:30', '13:05', '14:00', '14:45'],
  updateInterval: '60',
  dataRetentionDays: '30',
};

function ConfigDialog({ open, onOpenChange, config, onSaved }: ConfigDialogProps) {
  const [form, setForm] = useState<ConfigFormState>(DEFAULT_CONFIG_FORM);
  const [saving, setSaving] = useState(false);
  const [newEtfCode, setNewEtfCode] = useState('');
  const [newStockCode, setNewStockCode] = useState('');

  useEffect(() => {
    if (!open) return;

    if (!config) {
      setForm(DEFAULT_CONFIG_FORM);
      return;
    }

    setForm({
      watchlistEtf: config.watchlist_etf || [],
      watchlistStock: config.watchlist_stock || [],
      pushTimes: config.push_times?.length ? config.push_times : DEFAULT_CONFIG_FORM.pushTimes,
      updateInterval: String(config.update_interval || 60),
      dataRetentionDays: String(config.data_retention_days || 30),
    });
  }, [open, config]);

  const availableEtfOptions = DEFAULT_ETF_OPTIONS.filter(
    (item) => !form.watchlistEtf.some((existing) => existing.code === item.code)
  );
  const availableStockOptions = DEFAULT_STOCK_OPTIONS.filter(
    (item) => !form.watchlistStock.some((existing) => existing.code === item.code)
  );

  const addEtf = (code: string) => {
    const option = DEFAULT_ETF_OPTIONS.find((item) => item.code === code);
    if (!option) return;
    setForm((prev) => ({ ...prev, watchlistEtf: [...prev.watchlistEtf, option] }));
    setNewEtfCode('');
  };

  const addStock = (code: string) => {
    const option = DEFAULT_STOCK_OPTIONS.find((item) => item.code === code);
    if (!option) return;
    setForm((prev) => ({ ...prev, watchlistStock: [...prev.watchlistStock, option] }));
    setNewStockCode('');
  };

  const removeEtf = (code: string) => {
    setForm((prev) => ({
      ...prev,
      watchlistEtf: prev.watchlistEtf.filter((item) => item.code !== code),
    }));
  };

  const removeStock = (code: string) => {
    setForm((prev) => ({
      ...prev,
      watchlistStock: prev.watchlistStock.filter((item) => item.code !== code),
    }));
  };

  const updatePushTime = (time: string, checked: boolean) => {
    setForm((prev) => {
      const next = checked
        ? Array.from(new Set([...prev.pushTimes, time]))
        : prev.pushTimes.filter((item) => item !== time);
      return { ...prev, pushTimes: next.sort() };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const updateInterval = Number.parseInt(form.updateInterval, 10);
    const dataRetentionDays = Number.parseInt(form.dataRetentionDays, 10);

    if (Number.isNaN(updateInterval) || updateInterval < 10) {
      alert('更新间隔不能小于 10 秒');
      return;
    }

    if (Number.isNaN(dataRetentionDays) || dataRetentionDays < 1) {
      alert('数据保留天数不能小于 1 天');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/market-params/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlist_etf: form.watchlistEtf,
          watchlist_stock: form.watchlistStock,
          push_times: form.pushTimes,
          update_interval: updateInterval,
          data_retention_days: dataRetentionDays,
        }),
      });

      const result = (await response.json()) as ConfigResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存配置失败');
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const addDefault = async () => {
    const updateInterval = Number.parseInt(form.updateInterval, 10);
    const dataRetentionDays = Number.parseInt(form.dataRetentionDays, 10);

    if (Number.isNaN(updateInterval) || Number.isNaN(dataRetentionDays)) {
      alert('请输入有效的更新间隔和数据保留天数');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/market-params/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlist_etf: DEFAULT_ETF_OPTIONS,
          watchlist_stock: DEFAULT_STOCK_OPTIONS,
          push_times: DEFAULT_CONFIG_FORM.pushTimes,
          update_interval: updateInterval,
          data_retention_days: dataRetentionDays,
        }),
      });

      const result = (await response.json()) as ConfigResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '初始化配置失败');
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : '初始化配置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-slate-700 bg-[#151a25] text-slate-100">
        <DialogHeader>
          <DialogTitle>实时行情参数配置</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-slate-700/70 bg-[#0f131c] p-3">
              <div className="text-sm font-medium text-slate-200">自选 ETF</div>
              <div className="space-y-2">
                {form.watchlistEtf.map((item) => (
                  <div key={item.code} className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1 text-xs">
                    <span>{item.name}（{item.code}）</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeEtf(item.code)}>
                      删除
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Select value={newEtfCode} onValueChange={setNewEtfCode}>
                  <SelectTrigger className="h-8 border-slate-700 bg-[#1a2030] text-xs">
                    <SelectValue placeholder="选择要添加的 ETF" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-[#1a2030]">
                    {availableEtfOptions.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.name}（{item.code}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={() => addEtf(newEtfCode)} disabled={!newEtfCode}>
                  添加
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-700/70 bg-[#0f131c] p-3">
              <div className="text-sm font-medium text-slate-200">自选股票</div>
              <div className="space-y-2">
                {form.watchlistStock.map((item) => (
                  <div key={item.code} className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1 text-xs">
                    <span>{item.name}（{item.code}）</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeStock(item.code)}>
                      删除
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Select value={newStockCode} onValueChange={setNewStockCode}>
                  <SelectTrigger className="h-8 border-slate-700 bg-[#1a2030] text-xs">
                    <SelectValue placeholder="选择要添加的股票" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-[#1a2030]">
                    {availableStockOptions.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.name}（{item.code}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={() => addStock(newStockCode)} disabled={!newStockCode}>
                  添加
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/70 bg-[#0f131c] p-3">
            <div className="mb-2 text-sm font-medium text-slate-200">推送时间</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {DEFAULT_CONFIG_FORM.pushTimes.map((time) => (
                <label key={time} className="flex items-center gap-2 rounded bg-slate-800/60 px-2 py-1 text-xs">
                  <Switch
                    checked={form.pushTimes.includes(time)}
                    onCheckedChange={(checked: boolean) => updatePushTime(time, checked)}
                  />
                  <span>{time}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-slate-400">更新间隔（秒）</div>
              <Input
                value={form.updateInterval}
                onChange={(event) => setForm((prev) => ({ ...prev, updateInterval: event.target.value }))}
                type="number"
                min={10}
                className="border-slate-700 bg-[#1a2030]"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-400">数据保留天数</div>
              <Input
                value={form.dataRetentionDays}
                onChange={(event) => setForm((prev) => ({ ...prev, dataRetentionDays: event.target.value }))}
                type="number"
                min={1}
                className="border-slate-700 bg-[#1a2030]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              取消
            </Button>
            <Button type="button" variant="secondary" onClick={addDefault} disabled={saving}>
              恢复默认并初始化
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RealtimeMarketPanel() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<MarketParamsRecord | null>(null);
  const [config, setConfig] = useState<MarketParamsConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const fetchConfig = useCallback(async () => {
    const response = await fetchWithRetry('/api/market-params/config');
    const result = (await response.json()) as ConfigResponse;

    if (!response.ok || !result.success) {
      throw new Error(result.error || '获取实时行情配置失败');
    }

    setConfig(result.data);
  }, []);

  const fetchLatest = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [latestResponse] = await Promise.all([
        fetchWithRetry('/api/market-params?limit=1'),
        fetchConfig(),
      ]);

      const latestResult = (await latestResponse.json()) as MarketParamsResponse;
      if (!latestResponse.ok || !latestResult.success) {
        throw new Error(latestResult.error || '获取实时行情数据失败');
      }

      setLatest(latestResult.data.latest);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取实时行情数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchConfig]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    const intervalSeconds = Math.max(config?.update_interval || 60, 10);
    const timer = window.setInterval(() => {
      fetchLatest(true);
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [config?.update_interval, fetchLatest]);

  const indices = [
    {
      name: '上证指数',
      price: latest?.sh_price,
      change: latest?.sh_change_pct,
    },
    {
      name: '深证成指',
      price: latest?.sz_price,
      change: latest?.sz_change_pct,
    },
    {
      name: '创业板指',
      price: latest?.cyb_price,
      change: latest?.cyb_change_pct,
    },
  ];

  const breadthItems = [
    { label: '上涨家数', value: latest?.advance_count ?? 0 },
    { label: '下跌家数', value: latest?.decline_count ?? 0 },
    { label: '涨停', value: latest?.limit_up ?? 0 },
    { label: '跌停', value: latest?.limit_down ?? 0 },
  ];

  const etfList = latest?.watchlist_data?.etf?.length
    ? latest.watchlist_data.etf
    : config?.watchlist_etf || [];
  const stockList = latest?.watchlist_data?.stock?.length
    ? latest.watchlist_data.stock
    : config?.watchlist_stock || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-100">实时行情</div>
          <div className="text-xs text-slate-400">
            最后更新：{formatTime(latest?.timestamp)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchLatest(true)} disabled={loading || refreshing}>
            {refreshing ? '刷新中...' : '刷新'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfigOpen(true)}>
            配置
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {!error && !latest && !loading && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          暂无推送数据。请先确认李富贵已开启定时推送，并检查服务端 PUSH_TOKEN 配置。
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {indices.map((item) => (
          <div key={item.name} className="rounded-lg border border-slate-700/70 bg-[#151a25] p-3">
            <div className="text-xs text-slate-400">{item.name}</div>
            <div className="mt-1 flex items-end justify-between">
              <div className="text-lg font-semibold text-slate-100">{formatNumber(item.price)}</div>
              <div className={`text-sm ${changeClass(item.change)}`}>{changeText(item.change)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-700/70 bg-[#151a25] p-3">
        <div className="mb-2 text-xs text-slate-400">市场广度</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {breadthItems.map((item) => (
            <div key={item.label} className="rounded bg-slate-800/60 px-2 py-2">
              <div className="text-[11px] text-slate-400">{item.label}</div>
              <div className="text-sm font-medium text-slate-100">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          两市成交额：{formatNumber(latest?.total_volume, 0)} 亿
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-slate-700/70 bg-[#151a25] p-3">
          <div className="mb-2 text-xs text-slate-400">自选 ETF</div>
          <div className="space-y-2">
            {etfList.map((item) => (
              <div key={item.code} className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1.5 text-xs">
                <div>
                  <div className="text-slate-100">{item.name}</div>
                  <div className="text-[11px] text-slate-500">{item.code}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-100">{formatNumber(item.price, 3)}</div>
                  <div className={changeClass(item.change_pct)}>{changeText(item.change_pct)}</div>
                </div>
              </div>
            ))}
            {etfList.length === 0 && <div className="text-xs text-slate-500">暂无自选 ETF</div>}
          </div>
        </div>

        <div className="rounded-lg border border-slate-700/70 bg-[#151a25] p-3">
          <div className="mb-2 text-xs text-slate-400">自选股票</div>
          <div className="space-y-2">
            {stockList.map((item) => (
              <div key={item.code} className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1.5 text-xs">
                <div>
                  <div className="text-slate-100">{item.name}</div>
                  <div className="text-[11px] text-slate-500">{item.code}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-100">{formatNumber(item.price)}</div>
                  <div className={changeClass(item.change_pct)}>{changeText(item.change_pct)}</div>
                </div>
              </div>
            ))}
            {stockList.length === 0 && <div className="text-xs text-slate-500">暂无自选股票</div>}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700/70 bg-[#151a25] px-3 py-2 text-xs text-slate-400">
        推送 Token：
        {config?.push_token_configured
          ? `已配置${config.push_token_hint ? `（${config.push_token_hint}）` : ''}`
          : '未配置，请在服务端环境变量中设置 PUSH_TOKEN'}
      </div>

      <ConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        onSaved={() => fetchLatest(true)}
      />
    </div>
  );
}
