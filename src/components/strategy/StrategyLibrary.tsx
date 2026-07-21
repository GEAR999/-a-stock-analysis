'use client';

import { useState } from 'react';
import { Star, StarOff, Copy, Trash2, Edit, BookOpen, Sparkles, Filter, Search, Download, Upload } from 'lucide-react';
import {
  getAllStrategies, getBuiltinStrategies, getCustomStrategies,
  toggleFavorite, deleteCustomStrategy,
  exportStrategies, importStrategies,
  type StrategyDefinition, type StrategyCategory,
} from '@/lib/strategy-library';
import { StrategyCard } from './StrategyCard';
import { AIStrategyGenerator } from './AIStrategyGenerator';

type FilterType = 'all' | StrategyCategory;

export function StrategyLibrary() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const allStrategies = getAllStrategies();

  // 过滤策略
  const filtered = allStrategies.filter(s => {
    if (filter !== 'all' && s.category !== filter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // 分组
  const builtin = filtered.filter(s => s.category === 'builtin');
  const custom = filtered.filter(s => s.category === 'custom');
  const aiGenerated = filtered.filter(s => s.category === 'ai_generated');

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id);
    setRefreshKey(k => k + 1);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定删除此策略？')) {
      deleteCustomStrategy(id);
      setRefreshKey(k => k + 1);
    }
  };

  const handleExport = () => {
    const ids = allStrategies.filter(s => !s.id.startsWith('builtin_')).map(s => s.id);
    const json = exportStrategies(ids);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategies_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const count = importStrategies(text);
      if (count > 0) {
        setRefreshKey(k => k + 1);
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full gap-3" key={refreshKey}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <BookOpen size={14} className="text-accent-blue" />
          策略库
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={handleImport} className="p-1 text-text-secondary hover:text-accent-blue" title="导入策略">
            <Upload size={12} />
          </button>
          <button onClick={handleExport} className="p-1 text-text-secondary hover:text-accent-blue" title="导出策略">
            <Download size={12} />
          </button>
          <button
            onClick={() => setShowGenerator(!showGenerator)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ${
              showGenerator ? 'bg-accent-blue text-white' : 'bg-surface-raised text-text-secondary hover:text-accent-blue border border-border-subtle'
            }`}
          >
            <Sparkles size={10} />
            AI生成
          </button>
        </div>
      </div>

      {/* AI策略生成器 */}
      {showGenerator && (
        <AIStrategyGenerator onSaved={() => { setShowGenerator(false); setRefreshKey(k => k + 1); }} />
      )}

      {/* 搜索和过滤 */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索策略..."
            className="w-full bg-surface-input border border-border-subtle rounded px-2 py-1 pl-7 text-xs text-text-primary placeholder:text-text-secondary focus:border-accent-blue focus:outline-none"
          />
        </div>
        <div className="flex gap-0.5">
          {([['all', '全部'], ['builtin', '内置'], ['custom', '自定义'], ['ai_generated', 'AI']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                filter === val ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 策略列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0">
        {builtin.length > 0 && (
          <div>
            <div className="text-[10px] text-text-secondary mb-1 font-medium">内置策略 ({builtin.length})</div>
            <div className="grid grid-cols-1 gap-1.5">
              {builtin.map(s => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </div>
        )}

        {custom.length > 0 && (
          <div>
            <div className="text-[10px] text-text-secondary mb-1 font-medium">自定义策略 ({custom.length})</div>
            <div className="grid grid-cols-1 gap-1.5">
              {custom.map(s => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        {aiGenerated.length > 0 && (
          <div>
            <div className="text-[10px] text-text-secondary mb-1 font-medium">AI生成策略 ({aiGenerated.length})</div>
            <div className="grid grid-cols-1 gap-1.5">
              {aiGenerated.map(s => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-20 text-text-secondary">
            <Filter size={16} className="mb-1 opacity-30" />
            <p className="text-[10px]">没有匹配的策略</p>
          </div>
        )}
      </div>
    </div>
  );
}
