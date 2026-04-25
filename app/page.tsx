'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { listStocks, type Stock } from '@/lib/api';
import { formatMarketCap, formatDate, daysUntil, catalystColor, probColor } from '@/lib/utils';
import { InfoTooltip, LabelWithHelp } from '@/components/tooltips';
import { HELP } from '@/lib/help-text';

type SortKey = 'overall_score' | 'probability' | 'market_cap' | 'ticker';

export default function HomePage() {
  const [highProbOnly, setHighProbOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('overall_score');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['stocks', highProbOnly, sort],
    queryFn: () => listStocks({ high_prob_only: highProbOnly, sort, limit: 500 }),
  });

  const stocks = (data?.stocks || []).filter(s =>
    !search || s.ticker.includes(search.toUpperCase()) || s.company_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat label="Universe" value={data?.universe_size ?? '—'} help={HELP.screener.universe} />
        <Stat label="Showing" value={stocks.length} help={HELP.screener.showing} />
        <Stat label="High Probability" value={data?.high_prob_count ?? '—'} accent help={HELP.screener.high_probability} />
        <Stat label="Source" value="Live · Postgres" dim help={HELP.screener.source} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-panel p-3">
        <input
          placeholder="Search ticker or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={highProbOnly}
            onChange={(e) => setHighProbOnly(e.target.checked)}
            className="accent-emerald-500"
          />
          High-probability only
          <InfoTooltip text={HELP.screener.high_prob_filter} position="bottom" />
        </label>
        <div className="flex items-center gap-1.5">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            <option value="overall_score">Sort: overall score</option>
            <option value="probability">Sort: probability</option>
            <option value="market_cap">Sort: market cap</option>
            <option value="ticker">Sort: ticker</option>
          </select>
          <InfoTooltip text={HELP.screener.sort} position="bottom" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-red-300">
          Failed to load: {(error as Error).message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-md border border-border bg-panel" />
          ))}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-panel">
              <tr className="text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Catalyst</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">
                  <LabelWithHelp label="Prob" help={HELP.screener.probability} />
                </th>
                <th className="px-4 py-3 text-right">
                  <LabelWithHelp label="Score" help={HELP.screener.overall_score} />
                </th>
                <th className="px-4 py-3 text-right">Mkt Cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-bg">
              {stocks.map((s, i) => (
                <StockRow key={`${s.ticker}-${s.catalyst_type}-${s.catalyst_date}-${i}`} stock={s} />
              ))}
              {stocks.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-500">No stocks match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, dim, help }: { label: string; value: React.ReactNode; accent?: boolean; dim?: boolean; help?: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-neutral-500">
        {label}
        {help && <InfoTooltip text={help} position="bottom" />}
      </div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${accent ? 'text-emerald-400' : dim ? 'text-neutral-400' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function StockRow({ stock }: { stock: Stock }) {
  const d = daysUntil(stock.catalyst_date);
  return (
    <tr className="transition hover:bg-panel/50">
      <td className="px-4 py-3">
        <Link href={`/stocks/${stock.ticker}`} className="font-mono font-semibold text-neutral-100 hover:text-accent">
          {stock.ticker}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-300 max-w-xs truncate">{stock.company_name}</td>
      <td className={`px-4 py-3 text-sm ${catalystColor(stock.catalyst_type)}`}>{stock.catalyst_type}</td>
      <td className="px-4 py-3 text-sm text-neutral-400">
        {formatDate(stock.catalyst_date)}
        {d != null && d > 0 && <span className="ml-2 text-xs text-neutral-600">({d}d)</span>}
      </td>
      <td className={`px-4 py-3 text-right text-sm font-mono ${probColor(stock.probability)}`}>
        {(stock.probability * 100).toFixed(0)}%
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono text-neutral-300">{(stock.overall_score).toFixed(2)}</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-neutral-400">{formatMarketCap(stock.market_cap)}</td>
    </tr>
  );
}
