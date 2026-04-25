'use client';

import { useQuery } from '@tanstack/react-query';
import { History, TrendingUp, TrendingDown, Check, X, Minus, RefreshCw, Info } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface PostCatalystOutcome {
  id: number;
  ticker: string;
  catalyst_type?: string;
  catalyst_date: string;
  drug_name?: string;
  indication?: string;
  pre_event_price?: number;
  day1_price?: number;
  day7_price?: number;
  day30_price?: number;
  actual_move_pct_1d?: number;
  actual_move_pct_7d?: number;
  actual_move_pct_30d?: number;
  predicted_prob?: number;
  predicted_move_pct?: number;
  outcome?: 'approved' | 'rejected' | 'delayed' | 'mixed' | 'unknown' | string;
  outcome_confidence?: number;
  outcome_notes?: string;
  error_abs_pct?: number;
  direction_correct?: boolean;
  computed_at?: string;
}

interface AccuracyResp {
  total: number;
  direction_hits?: number;
  avg_abs_error_pct?: number | null;
  avg_signed_error_pct?: number | null;
  approved_count?: number;
  rejected_count?: number;
  mixed_count?: number;
  unknown_count?: number;
  direction_accuracy_pct?: number | null;
}

interface Props {
  ticker: string;
}

const OUTCOME_STYLE: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  approved: { color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', icon: <Check className="h-3 w-3" />, label: 'Approved' },
  rejected: { color: 'text-red-300 bg-red-500/10 border-red-500/30', icon: <X className="h-3 w-3" />, label: 'Rejected' },
  delayed:  { color: 'text-amber-300 bg-amber-500/10 border-amber-500/30', icon: <Minus className="h-3 w-3" />, label: 'Delayed' },
  mixed:    { color: 'text-violet-300 bg-violet-500/10 border-violet-500/30', icon: <Info className="h-3 w-3" />, label: 'Mixed' },
  unknown:  { color: 'text-neutral-400 bg-bg/40 border-border', icon: <Info className="h-3 w-3" />, label: 'Unknown' },
};

const fmtPct = (n: number | null | undefined, dp = 1): string => {
  if (n == null || isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(dp)}%`;
};

const fmtDate = (s: string): string => {
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return s; }
};

export function PostCatalystHistoryPanel({ ticker }: Props) {
  const historyQ = useQuery({
    queryKey: ['post-catalyst-history', ticker],
    queryFn: () => apiFetch(`/v2/post-catalyst/history/${encodeURIComponent(ticker)}?limit=50`) as Promise<{ ticker: string; count: number; outcomes: PostCatalystOutcome[] }>,
    staleTime: 5 * 60_000,
  });

  const accuracyQ = useQuery({
    queryKey: ['post-catalyst-accuracy'],
    queryFn: () => apiFetch('/v2/post-catalyst/accuracy') as Promise<AccuracyResp>,
    staleTime: 10 * 60_000,
  });

  const outcomes = historyQ.data?.outcomes || [];
  const accuracy = accuracyQ.data;

  // Per-ticker stats from outcomes list
  const tickerStats = (() => {
    if (!outcomes.length) return null;
    const withErr = outcomes.filter(o => o.error_abs_pct != null);
    const correct = outcomes.filter(o => o.direction_correct === true).length;
    const total = outcomes.filter(o => o.direction_correct != null).length;
    const avgErr = withErr.length ? withErr.reduce((s, o) => s + (o.error_abs_pct || 0), 0) / withErr.length : null;
    return {
      total: outcomes.length,
      direction_correct: correct,
      direction_total: total,
      direction_pct: total > 0 ? (correct / total) * 100 : null,
      avg_err: avgErr,
    };
  })();

  return (
    <div className="rounded-lg border border-border bg-panel p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2">
            <History className="h-5 w-5 text-violet-400" />
            Post-Catalyst History
            <InfoTooltip
              text="Past catalysts for this ticker — pre/post prices, actual moves vs our predicted moves, inferred outcome. Heuristic: ±25% on FDA-type catalysts = high-confidence approval/rejection. Small moves (|x|<5%) often mean already-priced-in or delayed."
              position="bottom"
            />
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            How accurate have predictions been on past catalysts?
          </p>
        </div>
        <button
          onClick={() => { historyQ.refetch(); accuracyQ.refetch(); }}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-neutral-400 hover:bg-bg/50"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={`This ticker · ${tickerStats?.total || 0} catalysts`}
          value={tickerStats?.direction_pct != null ? `${tickerStats.direction_pct.toFixed(0)}%` : '—'}
          sub={tickerStats ? `${tickerStats.direction_correct}/${tickerStats.direction_total} direction` : 'no history'}
        />
        <Stat
          label="Avg abs error (this ticker)"
          value={tickerStats?.avg_err != null ? `${tickerStats.avg_err.toFixed(1)}%` : '—'}
          sub="|predicted − actual_30d|"
        />
        <Stat
          label={`System-wide · ${accuracy?.total || 0} catalysts`}
          value={accuracy?.direction_accuracy_pct != null ? `${accuracy.direction_accuracy_pct}%` : '—'}
          sub={`${accuracy?.direction_hits || 0} direction hits`}
          accent="violet"
        />
        <Stat
          label="System-wide avg error"
          value={accuracy?.avg_abs_error_pct != null ? `${accuracy.avg_abs_error_pct.toFixed(1)}%` : '—'}
          sub="|predicted − actual_30d|"
        />
      </div>

      {/* History table */}
      {historyQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : outcomes.length === 0 ? (
        <div className="rounded-md border border-neutral-700 bg-bg/50 p-4 text-sm text-neutral-400">
          No past catalyst outcomes recorded for {ticker}. Run{' '}
          <code className="text-neutral-200">POST /admin/post-catalyst/backfill</code>{' '}
          to populate from yfinance.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-neutral-500">
              <tr className="border-b border-border/50">
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Type · Drug</th>
                <th className="px-2 py-2 text-right">Predicted</th>
                <th className="px-2 py-2 text-right">Actual (1d)</th>
                <th className="px-2 py-2 text-right">Actual (30d)</th>
                <th className="px-2 py-2 text-right">|Error|</th>
                <th className="px-2 py-2 text-center">Outcome</th>
                <th className="px-2 py-2 text-center">Direction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {outcomes.map((o) => {
                const oc = OUTCOME_STYLE[o.outcome || 'unknown'] || OUTCOME_STYLE.unknown;
                return (
                  <tr key={o.id} className="hover:bg-bg/40 transition" title={o.outcome_notes || ''}>
                    <td className="px-2 py-1.5 font-mono text-neutral-300">{fmtDate(o.catalyst_date)}</td>
                    <td className="px-2 py-1.5">
                      <div className="text-neutral-300">{o.catalyst_type || '—'}</div>
                      {(o.drug_name || o.indication) && (
                        <div className="text-[10px] text-neutral-500">
                          {o.drug_name}{o.drug_name && o.indication ? ' · ' : ''}{o.indication}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-neutral-400">
                      {fmtPct(o.predicted_move_pct)}
                      {o.predicted_prob != null && (
                        <div className="text-[10px] text-neutral-600">p={Math.round(o.predicted_prob * 100)}%</div>
                      )}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${(o.actual_move_pct_1d ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {fmtPct(o.actual_move_pct_1d)}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${(o.actual_move_pct_30d ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {fmtPct(o.actual_move_pct_30d)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-neutral-400">
                      {o.error_abs_pct != null ? `${o.error_abs_pct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${oc.color}`}>
                        {oc.icon}
                        {oc.label}
                        {o.outcome_confidence != null && (
                          <span className="ml-1 text-neutral-500">{Math.round(o.outcome_confidence * 100)}%</span>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {o.direction_correct === true ? (
                        <span title="Predicted direction matched actual" className="text-emerald-400">
                          <Check className="inline h-3.5 w-3.5" />
                        </span>
                      ) : o.direction_correct === false ? (
                        <span title="Predicted direction did NOT match actual" className="text-red-400">
                          <X className="inline h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'violet' }) {
  const valueColor = accent === 'violet' ? 'text-violet-200' : 'text-neutral-100';
  return (
    <div className="rounded-md border border-border bg-bg/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${valueColor}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}
