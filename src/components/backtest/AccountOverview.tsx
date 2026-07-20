import type { Account } from './types';
import { formatMoney, formatPercent } from './utils';

interface AccountOverviewProps {
  account: Account;
}

export function AccountOverview({ account }: AccountOverviewProps) {
  const totalAssets = account.currentCapital + account.positions.reduce((sum, p) => sum + p.quantity * p.avgCost, 0);
  const totalPnL = totalAssets - account.initialCapital;
  const totalPnLPercent = (totalPnL / account.initialCapital) * 100;

  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
        <div className="text-[10px] text-[var(--text-secondary)] mb-1">总资产</div>
        <div className="text-sm font-medium text-[var(--text-primary)] font-mono">{formatMoney(totalAssets)}</div>
      </div>
      <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
        <div className="text-[10px] text-[var(--text-secondary)] mb-1">总盈亏</div>
        <div className={`text-sm font-medium font-mono ${totalPnL >= 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
          {formatMoney(totalPnL)} ({formatPercent(totalPnLPercent)})
        </div>
      </div>
      <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
        <div className="text-[10px] text-[var(--text-secondary)] mb-1">持仓数</div>
        <div className="text-sm font-medium text-[var(--text-primary)]">{account.positions.length} 只</div>
      </div>
      <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-3">
        <div className="text-[10px] text-[var(--text-secondary)] mb-1">可用资金</div>
        <div className="text-sm font-medium text-[var(--text-primary)] font-mono">{formatMoney(account.currentCapital)}</div>
      </div>
    </div>
  );
}
