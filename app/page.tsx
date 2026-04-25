'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { listStocks, type Stock } from '@/lib/api';
import { formatMarketCap, formatDate, daysUntil, catalystColor, probColor } from '@/lib/utils';
import { InfoTooltip, LabelWithHelp } from '@/components/tooltips';
import { HELP } from '@/lib/help-text';

type SortKey = 'overall_score' | 'short_score' | 'probability' | 'market_cap' | 'ticker';
type Mode = 'long' | 'short' | 'all';

export default function HomePage() {
  const [highProbOnly, setHighProbOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('overall_score');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<Mode>('all');

  // API only knows non-short-score sorts. short_score is frontend-only; use overall_score for fetch.
  const apiSort = sort === 'short_score' ? 'overall_score' : sort;
  const { data, isLoading, error } = useQuery({
    queryKey: ['stocks', highProbOnly, apiSort],
    queryFn: () => listStocks({ high_prob_only: highProbOnly, sort: apiSort, limit: 500 }),
  });

  // Compute short_score for each stock: high when catalyst is risky (low prob FDA/Phase 3) and stock is small
  const computeShortScore = (s: Stock): number => {
    const probFailure = 1 - s.probability;
    const catalystWeight = (() => {
      const t = s.catalyst_type.toLowerCase();
      if (t.includes('fda') || t.includes('pdufa') || t.includes('decision')) return 1.0;
      if (t.includes('phase 3') || t.includes('phase iii')) return 0.9;
      if (t.includes('phase 2')) return 0.6;
      if (t.includes('adcomm')) return 0.7;
      if (t.includes('phase 1')) return 0.3;
      if (t.includes('partnership') || t.includes('earnings')) return 0.2;
      return 0.5;
    })();
    // Smaller market cap → higher short score (more downside on failure, easier to short)
    const sizePenalty = (() => {
      if (s.market_cap >= 50_000) return 0.4;  // mega cap, hard to short
      if (s.market_cap >= 10_000) return 0.7;
      if (s.market_cap >= 2_000) return 0.9;
      return 1.0;  // small cap
    })();
    return Math.min(1.0, probFailure * catalystWeight * sizePenalty);
  };

  const allStocksWithShort = (data?.stocks || []).map(s => ({
    ...s,
    short_score: computeShortScore(s),
  }));

  // Apply mode filter
  let stocks = allStocksWithShort;
  if (mode === 'long') {
    stocks = stocks.filter(s => s.probability >= 0.5);
  } else if (mode === 'short') {
    stocks = stocks.filter(s => s.short_score >= 0.4);
  }

  // Apply search filter
  stocks = stocks.filter(s =>
    !search || s.ticker.includes(search.toUpperCase()) || s.company_name.toLowerCase().includes(search.toLowerCase())
  );

  // Apply sort by short_score if selected
  if (sort === 'short_score') {
    stocks = [...stocks].sort((a, b) => b.short_score - a.short_score);
  }

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat label="Universe" value={data?.universe_size ?? '—'} help={HELP.screener.universe} />
        <Stat label="Showing" value={stocks.length} help={HELP.screener.showing} />
        <Stat label="High Probability" value={data?.high_prob_count ?? '—'} accent help={HELP.screener.high_probability} />
        <Stat label="Source" value="Live · Postgres" dim help={HELP.screener.source} />
      </div>

      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-panel p-3">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Mode</span>
        <div className="flex gap-1">
          {(['long','short','all'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                mode === m
                  ? (m === 'long' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                     m === 'short' ? 'bg-red-500/15 text-red-300 border border-red-500/30' :
                     'bg-neutral-700/30 text-neutral-200 border border-neutral-600/30')
                  : 'bg-bg/50 text-neutral-400 border border-border hover:text-neutral-200'
              }`}
            >
              {m === 'long' ? '⬆ Long bias' : m === 'short' ? '⬇ Short bias' : 'All'}
            </button>
          ))}
        </div>
        <InfoTooltip
          text="Long bias: catalysts with ≥50% probability. Short bias: high-conviction failure setups (low prob × high-impact catalyst × smaller cap = more shortable). All: every catalyst."
          position="bottom"
        />
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
            <option value="short_score">Sort: short score</option>
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
                {mode !== 'long' && (
                  <th className="px-4 py-3 text-right">
                    <LabelWithHelp label="Short" help="Short score 0-1: higher = better short setup. Computed from (1-probability) × catalyst weight × size penalty. >0.4 = decent short candidate." />
                  </th>
                )}
                <th className="px-4 py-3 text-right">Mkt Cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-bg">
              {stocks.map((s, i) => (
                <StockRow key={`${s.ticker}-${s.catalyst_type}-${s.catalyst_date}-${i}`} stock={s} mode={mode} />
              ))}
              {stocks.length === 0 && (
                <tr><td colSpan={mode !== 'long' ? 8 : 7} className="px-4 py-12 text-center text-neutral-500">No stocks match your filters</td></tr>
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

function StockRow({ stock, mode }: { stock: Stock & { short_score: number }; mode: Mode }) {
  const d = daysUntil(stock.catalyst_date);
  const shortColor = stock.short_score >= 0.6 ? 'text-red-300' : stock.short_score >= 0.4 ? 'text-amber-300' : 'text-neutral-500';
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
      {mode !== 'long' && (
        <td className={`px-4 py-3 text-right text-sm font-mono ${shortColor}`}>
          {stock.short_score.toFixed(2)}
        </td>
      )}
      <td className="px-4 py-3 text-right text-sm font-mono text-neutral-400">{formatMarketCap(stock.market_cap)}</td>
    </tr>
  );
}
