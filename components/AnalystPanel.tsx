'use client';

import { TrendingUp } from 'lucide-react';
import type { AnalystData } from '@/lib/api';

type AnalystSource = {
  consensus?: string;
  target_mean?: number;
  target_high?: number;
  target_low?: number;
  upside_pct?: number;
  current_price?: number;
  analyst_count?: number;
  buy?: number;
  strong_buy?: number;
  hold?: number;
  sell?: number;
  strong_sell?: number;
  recent_changes?: Array<{
    date: string;
    firm: string;
    to_grade: string;
    from_grade?: string;
    action?: string;
  }>;
  error?: string | null;
};

export function AnalystPanel({ data, loading }: { data?: AnalystData; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-3">Analyst Consensus</h2>
        <div className="h-40 animate-pulse rounded-md border border-border bg-bg/50" />
      </div>
    );
  }

  // Data arrives as { yfinance: {...}, tipranks: {...}, seeking_alpha: {...} }
  const d = (data?.data ?? {}) as Record<string, AnalystSource>;
  // Prefer yfinance (most complete), fall back to tipranks
  const primary: AnalystSource =
    (d.yfinance && !d.yfinance.error && d.yfinance.consensus) ? d.yfinance
    : (d.tipranks && !d.tipranks.error) ? d.tipranks
    : (d.yfinance as AnalystSource) || {};

  if (!primary || (!primary.consensus && primary.target_mean == null)) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-3">Analyst Consensus</h2>
        <p className="text-sm text-neutral-500">No analyst data available.</p>
      </div>
    );
  }

  const consensus = primary.consensus || '—';
  const consensusColor =
    consensus.toLowerCase().includes('strong buy') ? 'text-emerald-300'
    : consensus.toLowerCase() === 'buy' ? 'text-emerald-400'
    : consensus.toLowerCase() === 'hold' ? 'text-amber-400'
    : consensus.toLowerCase().includes('sell') ? 'text-red-400'
    : 'text-neutral-300';

  const totalRatings =
    (primary.strong_buy || 0) + (primary.buy || 0) + (primary.hold || 0) + (primary.sell || 0) + (primary.strong_sell || 0);

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2>Analyst Consensus</h2>
        {primary.analyst_count != null && (
          <span className="text-xs text-neutral-500">{primary.analyst_count} analysts</span>
        )}
      </div>

      {/* Consensus + price target row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-border bg-bg/50 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Rating</div>
          <div className={`mt-1 text-2xl font-semibold ${consensusColor}`}>{consensus}</div>
        </div>
        <div className="rounded-md border border-border bg-bg/50 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Price Target</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-400">
            {primary.target_mean != null ? `$${primary.target_mean.toFixed(2)}` : '—'}
          </div>
          {primary.upside_pct != null && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-emerald-300">
              <TrendingUp className="h-3 w-3" />
              {primary.upside_pct.toFixed(1)}% upside
            </div>
          )}
        </div>
      </div>

      {/* High/low range */}
      {(primary.target_high != null || primary.target_low != null) && (
        <div className="mt-3 text-xs text-neutral-500">
          Range: ${primary.target_low?.toFixed(2) ?? '—'} — ${primary.target_high?.toFixed(2) ?? '—'}
        </div>
      )}

      {/* Buy/Sell breakdown */}
      {totalRatings > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Distribution</div>
          <div className="flex h-2 overflow-hidden rounded-full bg-neutral-800">
            {primary.strong_buy ? (
              <div
                className="bg-emerald-600"
                style={{ width: `${((primary.strong_buy) / totalRatings) * 100}%` }}
                title={`${primary.strong_buy} Strong Buy`}
              />
            ) : null}
            {primary.buy ? (
              <div
                className="bg-emerald-500"
                style={{ width: `${((primary.buy) / totalRatings) * 100}%` }}
                title={`${primary.buy} Buy`}
              />
            ) : null}
            {primary.hold ? (
              <div
                className="bg-amber-500"
                style={{ width: `${((primary.hold) / totalRatings) * 100}%` }}
                title={`${primary.hold} Hold`}
              />
            ) : null}
            {primary.sell ? (
              <div
                className="bg-red-500"
                style={{ width: `${((primary.sell) / totalRatings) * 100}%` }}
                title={`${primary.sell} Sell`}
              />
            ) : null}
            {primary.strong_sell ? (
              <div
                className="bg-red-700"
                style={{ width: `${((primary.strong_sell) / totalRatings) * 100}%` }}
                title={`${primary.strong_sell} Strong Sell`}
              />
            ) : null}
          </div>
          <div className="mt-1 flex justify-between text-xs text-neutral-500">
            <span>Buy: {(primary.strong_buy || 0) + (primary.buy || 0)}</span>
            <span>Hold: {primary.hold || 0}</span>
            <span>Sell: {(primary.sell || 0) + (primary.strong_sell || 0)}</span>
          </div>
        </div>
      )}

      {/* Recent rating changes */}
      {primary.recent_changes && primary.recent_changes.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Recent changes</div>
          <ul className="space-y-1 text-xs">
            {primary.recent_changes.slice(0, 4).map((c, i) => (
              <li key={`${c.date}-${c.firm}-${i}`} className="flex items-center justify-between text-neutral-400">
                <span>
                  <span className="text-neutral-200">{c.firm}</span>
                  {c.action === 'up' && <span className="ml-2 text-emerald-400">↑</span>}
                  {c.action === 'down' && <span className="ml-2 text-red-400">↓</span>}
                </span>
                <span className="flex items-center gap-2">
                  {c.from_grade && c.from_grade !== c.to_grade && (
                    <span className="text-neutral-600">{c.from_grade} →</span>
                  )}
                  <span className="text-neutral-200">{c.to_grade}</span>
                  <span className="text-neutral-600">{c.date}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
