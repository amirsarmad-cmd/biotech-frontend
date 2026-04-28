'use client';

import { useQuery } from '@tanstack/react-query';
import { History, TrendingUp, TrendingDown, Check, X, Minus, RefreshCw, Info } from 'lucide-react';
import { apiFetch, getBacktestAggregateV2, getBacktestAggregateV3, getV1vsV2SameRow, type AggregateV2Response, type AggregateV3Response, type SameRowABResponse, type WilsonCI } from '@/lib/api';
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
  options_implied_move_pct?: number | null;
  options_implied_move_source?: string | null;
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

  // Three-tier scoreboard: all-events (raw 30D, noisy) vs tradeable subset
  // (3D abnormal-vs-XBI, real edge after abstention).
  const aggV2Q = useQuery({
    queryKey: ['post-catalyst-aggregate-v2'],
    queryFn: () => getBacktestAggregateV2(),
    staleTime: 10 * 60_000,
  });

  // V3 — priced-in-aware (LONG_UNDERPRICED_POSITIVE / SHORT_SELL_THE_NEWS)
  const aggV3Q = useQuery({
    queryKey: ['post-catalyst-aggregate-v3'],
    queryFn: () => getBacktestAggregateV3(),
    staleTime: 10 * 60_000,
  });

  // Same-row A/B between V1 and V2 — settles whether V2 actually beats V1.
  // ChatGPT's critique: 'Compare V1 and V2 on same rows. V2 may not beat V1 —
  // it may just be more selective.'
  const sameRowQ = useQuery({
    queryKey: ['post-catalyst-v1-vs-v2-same-row'],
    queryFn: () => getV1vsV2SameRow(),
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

      {/* Per-ticker stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>

      {/* System-wide three-tier scoreboard. Replaces the broken single 52.5%
          stat. After user critique that scoring every catalyst the same way
          masks true model edge, we now show:
            All-event raw 30D     — noise floor (≈50%)
            Tradeable subset 3D   — model's actual edge after abstention
            Coverage              — fraction of all events that were tradeable
          The interpretation footer explains what each number means and what
          the actionable target is. */}
      <ThreeTierScoreboard agg={aggV2Q.data} loading={aggV2Q.isLoading} />

      {/* V2 priced-in-aware breakdown — splits high-prob LONG signals into
          UNDERPRICED (real long edge) vs SELL_THE_NEWS (priced-in fade)
          using the runup_30d-derived priced-in score. */}
      <V2BucketsCard
        agg={aggV3Q.data}
        loading={aggV3Q.isLoading}
        sameRow={sameRowQ.data}
        sameRowLoading={sameRowQ.isLoading}
      />

      {/* (Removed BacktestHealthBanner — its 52.5%/15.9% raw 30D numbers
          are now covered, with proper context, by the ThreeTierScoreboard
          above. Showing both was confusing per user feedback.) */}

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
                <th className="px-2 py-2 text-right" title="ATM straddle-implied move at the catalyst window. Captured at backfill time when yfinance options data is available — not retro-fillable for older events.">Options ±</th>
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
                    <td className="px-2 py-1.5 text-right font-mono text-cyan-300">
                      {o.options_implied_move_pct != null
                        ? `±${Math.abs(o.options_implied_move_pct).toFixed(1)}%`
                        : <span className="text-neutral-700">—</span>}
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

/**
 * Honest disclosure banner showing how well our predictions match reality.
 * - Below 45% direction accuracy: red — model is actively misleading
 * - 45-55%: amber — model is essentially noise
 * - 55-65%: violet — modest predictive power
 * - 65%+: green — useful signal
 *
 * Also surfaces the avg_signed_error to flag systematic bias (positive =
 * model over-predicts upside; negative = under-predicts).
 */
function BacktestHealthBanner({ accuracy }: { accuracy: AccuracyResp }) {
  const acc = accuracy.direction_accuracy_pct ?? 0;
  const signedErr = accuracy.avg_signed_error_pct ?? 0;
  const absErr = accuracy.avg_abs_error_pct ?? 0;
  const n = accuracy.total ?? 0;

  let tone: 'red' | 'amber' | 'violet' | 'green';
  let headline: string;
  let detail: string;

  if (acc < 45) {
    tone = 'red';
    headline = `Backtest below random (${acc.toFixed(0)}% direction accuracy on N=${n})`;
    detail = 'Our predicted_move_pct is currently a worse-than-coin-flip predictor of post-catalyst direction. Treat as approximate magnitude only — not direction.';
  } else if (acc < 55) {
    tone = 'amber';
    headline = `Backtest near random (${acc.toFixed(0)}% direction accuracy on N=${n})`;
    detail = 'Predicted moves match reality at roughly coin-flip rate. The options-implied move panel above shows the market consensus — which has historically been more accurate than our reference table.';
  } else if (acc < 65) {
    tone = 'violet';
    headline = `Modest predictive signal (${acc.toFixed(0)}% on N=${n})`;
    detail = 'Predictions beat random but with significant noise. Use as one input among many, not a sole basis for trades.';
  } else {
    tone = 'green';
    headline = `Strong backtest signal (${acc.toFixed(0)}% on N=${n})`;
    detail = `Predictions show real predictive power. Avg abs error ${absErr.toFixed(1)}pts.`;
  }

  // Bias note
  const biasNote = Math.abs(signedErr) > 5
    ? `Systematic bias: model ${signedErr > 0 ? 'over' : 'under'}-predicts moves by avg ${Math.abs(signedErr).toFixed(1)}pts. ${signedErr > 0 ? 'FDA approvals are usually priced-in, so reality moves less than the reference table predicts.' : 'Model under-states tail risk on rejections.'}`
    : null;

  const toneClass = {
    red:    'border-red-500/30 bg-red-500/10',
    amber:  'border-amber-500/30 bg-amber-500/5',
    violet: 'border-violet-500/30 bg-violet-500/5',
    green:  'border-emerald-500/30 bg-emerald-500/5',
  }[tone];

  const headlineColor = {
    red: 'text-red-200',
    amber: 'text-amber-200',
    violet: 'text-violet-200',
    green: 'text-emerald-200',
  }[tone];

  const Icon = tone === 'red' ? X : tone === 'amber' ? Info : tone === 'violet' ? Info : Check;

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className={`flex items-center gap-2 text-sm font-medium ${headlineColor}`}>
        <Icon className="h-4 w-4" />
        {headline}
      </div>
      <div className="mt-1 pl-6 text-xs text-neutral-400 leading-relaxed">{detail}</div>
      {biasNote && (
        <div className="mt-1 pl-6 text-xs text-amber-100/80 leading-relaxed">
          <span className="text-amber-300">⚠ </span>{biasNote}
        </div>
      )}
    </div>
  );
}


// ────────────────────────────────────────────────────────────
// Three-tier backtest scoreboard
// ────────────────────────────────────────────────────────────
// Replaces the broken single '52.5% direction accuracy across 358 events'
// stat. After user critique:
//   'Chasing 70% across all catalysts is overfitting. Real target is
//    70%+ on tradeable subset with abstention.'

function ThreeTierScoreboard({ agg, loading }: { agg: AggregateV2Response | undefined; loading: boolean }) {
  if (loading || !agg) {
    return (
      <div className="rounded-md border border-border bg-bg-card/40 p-3">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">System-wide accuracy</div>
        <div className="text-xs text-neutral-500 mt-1">Loading scoreboard…</div>
      </div>
    );
  }

  const all = agg.all_events;
  const tr = agg.tradeable_events;

  // Color the tradeable accuracy: ≥65% green, ≥55% amber, <55% red
  const trAccent: 'emerald' | 'amber' | 'red' | 'neutral' = (() => {
    const v = tr.direction_accuracy_pct;
    if (v == null) return 'neutral';
    if (v >= 65) return 'emerald';
    if (v >= 55) return 'amber';
    return 'red';
  })();
  const trColor =
    trAccent === 'emerald' ? 'text-emerald-300 border-emerald-500/40' :
      trAccent === 'amber' ? 'text-amber-300 border-amber-500/40' :
        trAccent === 'red' ? 'text-red-300 border-red-500/40' :
          'text-neutral-300 border-border';

  // Coverage color: 25-40% is the actionable band
  const cv = tr.coverage_pct ?? 0;
  const cvColor =
    cv >= 25 && cv <= 40 ? 'text-emerald-300' :
      cv > 40 ? 'text-amber-300' :
        'text-orange-300';

  return (
    <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3 space-y-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-violet-300">
        System-wide backtest scoreboard
        <InfoTooltip
          text="A single 'system-wide accuracy' number is misleading because it averages weak/no-edge events with high-conviction setups. This three-tier breakdown shows the noise floor (all-events) vs the model's actual edge on the tradeable subset (where abstention rules let signals through)."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* All events — raw 30D direction (noise floor) */}
        <div className="rounded border border-border bg-bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">All events</div>
          <div className="text-2xl font-mono font-medium text-neutral-200 mt-1">
            {all.direction_accuracy_pct != null ? `${all.direction_accuracy_pct}%` : '—'}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            {all.direction_hits} / {all.count} · raw 30D direction
          </div>
          <div className="text-[10px] text-neutral-600 mt-1">
            Avg abs error: {all.avg_abs_error_pct != null ? `${all.avg_abs_error_pct}%` : '—'}
          </div>
          <div className="text-[9px] text-neutral-600 mt-1.5 leading-snug">
            Noise floor — sector + macro contaminate every event including no-edge ones.
          </div>
        </div>

        {/* Tradeable subset — 3D abnormal vs XBI (the real number) */}
        <div className={`rounded border-2 ${trColor} bg-bg-card p-3`}>
          <div className="text-[10px] uppercase tracking-wide text-violet-300 flex items-center gap-1">
            Tradeable subset
            <InfoTooltip
              text="Filtered to events where the model expressed a directional bet (LONG or SHORT) with high enough probability and scenario edge. Abstention rules: probability bias > 0.15, scenario magnitude ≥ 5%, confidence ≥ 0.55, binary catalyst type, exact date. Direction scored against 3-day abnormal return vs XBI (sector-adjusted)."
            />
          </div>
          <div className={`text-2xl font-mono font-medium mt-1 ${trColor.split(' ')[0]}`}>
            {tr.direction_accuracy_pct != null ? `${tr.direction_accuracy_pct}%` : '—'}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            {tr.direction_hits} / {tr.count} · 3D abnormal-vs-XBI
          </div>
          <div className="text-[10px] text-neutral-600 mt-1">
            Avg abs error: {tr.avg_abs_error_pct != null ? `${tr.avg_abs_error_pct}%` : '—'}
          </div>
          <div className="text-[9px] text-neutral-600 mt-1.5 leading-snug">
            Target: ≥65-70% with coverage 25-40%.
          </div>
        </div>

        {/* Coverage — what fraction of all events became tradeable */}
        <div className="rounded border border-border bg-bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500 flex items-center gap-1">
            Coverage
            <InfoTooltip
              text="Fraction of all events that became tradeable signals (LONG or SHORT). Too high (>40%) means the abstention is too loose — model picks events with no edge. Too low (<25%) means it's over-selective — missing valid setups. The right operating range is 25-40%."
            />
          </div>
          <div className={`text-2xl font-mono font-medium mt-1 ${cvColor}`}>
            {tr.coverage_pct != null ? `${tr.coverage_pct}%` : '—'}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            {tr.count} of {all.count} tradeable
          </div>
          <div className="text-[9px] text-neutral-600 mt-1.5 leading-snug">
            {cv >= 25 && cv <= 40 ? 'In the actionable band.' : (cv > 40 ? 'Too inclusive — abstention loose.' : 'Too selective — abstention tight.')}
          </div>
        </div>
      </div>

      {/* Signal distribution — what the abstention reasons look like */}
      {agg.signal_distribution && agg.signal_distribution.length > 0 && (
        <div className="border-t border-border/40 pt-2">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
            Signal distribution
          </div>
          <div className="flex flex-wrap gap-1.5">
            {agg.signal_distribution.map((s) => {
              const isTradeable = s.signal === 'LONG' || s.signal === 'SHORT';
              const cls = isTradeable
                ? (s.signal === 'LONG' ? 'border-emerald-500/40 text-emerald-300' : 'border-orange-500/40 text-orange-300')
                : 'border-border text-neutral-400';
              return (
                <span key={s.signal} className={`inline-flex items-center gap-1 rounded border ${cls} bg-bg-card/40 px-2 py-0.5 text-[10px]`}>
                  <span className="font-medium">{s.signal}</span>
                  <span className="text-neutral-500">·</span>
                  <span className="font-mono">{s.count}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Honest interpretation footer */}
      <div className="text-[10px] text-neutral-500 leading-relaxed border-t border-border/40 pt-2 space-y-0.5">
        <div>
          <span className="text-neutral-400">Why two numbers:</span> {agg.interpretation.noise_floor}.
        </div>
        <div>
          <span className="text-neutral-400">Actionable target:</span> {agg.interpretation.actionable_target}.
        </div>
      </div>
    </div>
  );
}


// ────────────────────────────────────────────────────────────
// V2 priced-in-aware classifier breakdown
// ────────────────────────────────────────────────────────────
// V2 adds a runup-based priced-in filter to V1's probability-bias
// classifier. After empirical buckets showed:
//   Flat-runup setups (avg -0.5%): V1 LONG = 77.5% on judged
//   Strong-runup setups (≥+20%):   V1 LONG = 33.3% (inverse 67%)
// the V2 thresholds were retuned (priced_in ≤ 0.60 → LONG_UNDERPRICED,
// priced_in ≥ 0.80 → SHORT_SELL_THE_NEWS, mid → NO_TRADE_PRICED_IN).
//
// Numbers in the UI are IN-SAMPLE (V2 thresholds tuned on the same
// 459-row backtest). All buckets show 95% Wilson CIs because at
// n_judged 24-105, point estimates are not enough to claim
// production-grade accuracy.
//
// HISTORY: An earlier version of this card cited '31.7% V1 accuracy /
// inverse 68.3%' as motivation for V2. That number came from a SQL
// denominator bug (deadband NULLs counted as misses). Real V1 is
// 58.4% and the inverse thesis was incorrect. V2 still improves on V1
// via the priced-in filter, but the lift should be measured on
// same-row A/B (see /admin/post-catalyst/v1-vs-v2-same-row).

function formatCI(ci: WilsonCI | null | undefined): string {
  if (!ci) return '';
  return `CI ${ci.lower_pct}–${ci.upper_pct}%`;
}

function V2BucketsCard({
  agg, loading, sameRow, sameRowLoading,
}: {
  agg: AggregateV3Response | undefined;
  loading: boolean;
  sameRow: SameRowABResponse | undefined;
  sameRowLoading: boolean;
}) {
  if (loading || !agg) {
    return (
      <div className="rounded-md border border-border bg-bg-card/40 p-3">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">V2 priced-in classifier</div>
        <div className="text-xs text-neutral-500 mt-1">Loading…</div>
      </div>
    );
  }

  const v1 = agg.tradeable_v1;
  const v2 = agg.tradeable_v2;

  // Filter buckets to tradeable signals + meaningful no-trade reasons
  const tradeable_buckets = (agg.v2_buckets || []).filter(b =>
    ['LONG_UNDERPRICED_POSITIVE', 'SHORT_SELL_THE_NEWS', 'SHORT_LOW_PROBABILITY', 'LONG', 'SHORT'].includes(b.signal)
  );
  const skipped_buckets = (agg.v2_buckets || []).filter(b =>
    !['LONG_UNDERPRICED_POSITIVE', 'SHORT_SELL_THE_NEWS', 'SHORT_LOW_PROBABILITY', 'LONG', 'SHORT'].includes(b.signal)
  );

  const accColor = (v: number | null) => {
    if (v == null) return 'text-neutral-400';
    if (v >= 65) return 'text-emerald-300';
    if (v >= 55) return 'text-amber-300';
    return 'text-red-300';
  };

  const signalColor = (s: string) => {
    if (s.startsWith('LONG')) return 'border-emerald-500/40 text-emerald-300';
    if (s.startsWith('SHORT')) return 'border-orange-500/40 text-orange-300';
    return 'border-border text-neutral-400';
  };

  return (
    <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3 space-y-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-violet-300">
        V2 priced-in-aware classifier
        <InfoTooltip
          text={`V1 uses probability bias alone (p > 0.60 → LONG, p < 0.40 → SHORT). V2 adds a priced-in filter using pre-event 30d runup as a proxy: priced_in ≤ 0.60 (washed-out + flat setups) → LONG_UNDERPRICED_POSITIVE; priced_in ≥ 0.80 (strong runup) → SHORT_SELL_THE_NEWS; mid-zone → NO_TRADE_PRICED_IN. Thresholds were retuned in-sample after empirical bucket data showed flat-runup events have ~78% V1 LONG accuracy and strong-runup events fade ~67%. All numbers below are in-sample with 95% Wilson CIs because at n=24-105 judged rows, point estimates alone aren't enough to claim production-grade accuracy.`}
        />
      </div>

      {/* V1 vs V2 head-to-head summary with confidence intervals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded border border-border bg-bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">V1 (probability only)</div>
          <div className={`text-2xl font-mono font-medium mt-1 ${accColor(v1.direction_accuracy_pct)}`}>
            {v1.direction_accuracy_pct != null ? `${v1.direction_accuracy_pct}%` : '—'}
          </div>
          {v1.ci_95_pct && (
            <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
              95% {formatCI(v1.ci_95_pct)}
            </div>
          )}
          <div className="text-[10px] text-neutral-500 mt-0.5">
            {v1.direction_hits} / {v1.judged ?? v1.count} judged · {v1.coverage_pct ?? '—'}% coverage
          </div>
          <div className="text-[9px] text-neutral-600 mt-1">
            LONG when p &gt; 0.60, SHORT when p &lt; 0.40
          </div>
        </div>

        <div className="rounded border-2 border-violet-500/40 bg-bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-violet-300">V2 (priced-in aware)</div>
          <div className={`text-2xl font-mono font-medium mt-1 ${accColor(v2.direction_accuracy_pct)}`}>
            {v2.direction_accuracy_pct != null ? `${v2.direction_accuracy_pct}%` : '—'}
          </div>
          {v2.ci_95_pct && (
            <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
              95% {formatCI(v2.ci_95_pct)}
            </div>
          )}
          <div className="text-[10px] text-neutral-500 mt-0.5">
            {v2.direction_hits} / {v2.judged ?? v2.count} judged · {v2.coverage_pct ?? '—'}% coverage
          </div>
          <div className="text-[9px] text-neutral-600 mt-1">
            + runup-based priced-in filter (in-sample)
          </div>
        </div>
      </div>

      {/* Same-row A/B — settles whether V2 is actually better than V1 */}
      {sameRow && sameRow.common_judged > 0 && (
        <div className="rounded border border-border bg-bg-card/40 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500 mb-1.5">
            Same-row A/B (V1 vs V2)
            <InfoTooltip text="Per-row comparison on events where both V1 and V2 classify as tradeable AND have a judged outcome (|abnormal_3d| ≥ 3%). V2 is meaningfully better than V1 only if v2_lift ≥ 3pp AND v2-only-correct > v1-only-correct AND CI ranges don't substantially overlap." />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <div className="text-neutral-500">Common judged</div>
              <div className="font-mono text-neutral-200">{sameRow.common_judged}</div>
            </div>
            <div>
              <div className="text-neutral-500">V1 acc</div>
              <div className={`font-mono ${accColor(sameRow.v1.accuracy_pct)}`}>
                {sameRow.v1.accuracy_pct ?? '—'}%
              </div>
              {sameRow.v1.ci_95_pct && (
                <div className="text-[9px] text-neutral-600">{formatCI(sameRow.v1.ci_95_pct)}</div>
              )}
            </div>
            <div>
              <div className="text-neutral-500">V2 acc</div>
              <div className={`font-mono ${accColor(sameRow.v2.accuracy_pct)}`}>
                {sameRow.v2.accuracy_pct ?? '—'}%
              </div>
              {sameRow.v2.ci_95_pct && (
                <div className="text-[9px] text-neutral-600">{formatCI(sameRow.v2.ci_95_pct)}</div>
              )}
            </div>
            <div>
              <div className="text-neutral-500">V2 lift</div>
              <div className={`font-mono ${
                sameRow.v2_lift_pp == null ? 'text-neutral-400' :
                  sameRow.v2_lift_pp >= 3 ? 'text-emerald-300' :
                    sameRow.v2_lift_pp <= -3 ? 'text-red-300' :
                      'text-amber-300'
              }`}>
                {sameRow.v2_lift_pp != null ? `${sameRow.v2_lift_pp >= 0 ? '+' : ''}${sameRow.v2_lift_pp} pp` : '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] mt-2 pt-2 border-t border-border/40">
            <div>
              <div className="text-neutral-600">Both correct</div>
              <div className="font-mono text-emerald-300">{sameRow.agreement.both_correct}</div>
            </div>
            <div>
              <div className="text-neutral-600">Both wrong</div>
              <div className="font-mono text-red-300">{sameRow.agreement.both_wrong}</div>
            </div>
            <div>
              <div className="text-neutral-600">V1 only right</div>
              <div className="font-mono text-amber-300">{sameRow.agreement.v1_only_correct}</div>
            </div>
            <div>
              <div className="text-neutral-600">V2 only right</div>
              <div className="font-mono text-violet-300">{sameRow.agreement.v2_only_correct}</div>
            </div>
          </div>
        </div>
      )}
      {sameRowLoading && (
        <div className="rounded border border-border bg-bg-card/40 p-3">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Same-row A/B</div>
          <div className="text-[11px] text-neutral-500 mt-1">Loading…</div>
        </div>
      )}

      {/* Per-bucket breakdown — tradeable signals first, then skipped */}
      {tradeable_buckets.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Tradeable buckets</div>
          {tradeable_buckets.map((b) => (
            <div key={b.signal} className="flex items-center gap-2 text-[11px] flex-wrap">
              <span className={`inline-flex items-center rounded border ${signalColor(b.signal)} bg-bg-card px-2 py-0.5 font-medium w-56 shrink-0`}>
                {b.signal}
              </span>
              <span className="text-neutral-500 w-24 shrink-0 text-right">
                n={b.count} · judged={b.judged}
              </span>
              <span className={`font-mono font-medium w-16 text-right ${accColor(b.direction_accuracy_pct)}`}>
                {b.direction_accuracy_pct != null ? `${b.direction_accuracy_pct}%` : '—'}
              </span>
              {b.ci_95_pct && (
                <span className="text-[10px] text-neutral-500 font-mono">
                  {formatCI(b.ci_95_pct)}
                </span>
              )}
              {b.avg_priced_in_score != null && (
                <span className="text-[10px] text-neutral-500">
                  priced_in {b.avg_priced_in_score.toFixed(2)}
                </span>
              )}
              {!b.production_ready && b.judged > 0 && (
                <span className="text-[9px] uppercase rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 px-1.5 py-0.5"
                      title="Research-only: requires n≥50 AND CI lower > 55% to be promoted to production signal.">
                  research only
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {skipped_buckets.length > 0 && (
        <div className="space-y-1 border-t border-border/40 pt-2">
          <div className="text-[10px] uppercase tracking-wide text-neutral-600">Skipped (abstention reasons)</div>
          <div className="flex flex-wrap gap-1.5">
            {skipped_buckets.map((b) => (
              <span key={b.signal} className="inline-flex items-center gap-1 rounded border border-border bg-bg-card/40 px-2 py-0.5 text-[10px] text-neutral-400">
                <span>{b.signal}</span>
                <span className="text-neutral-600">·</span>
                <span className="font-mono">{b.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Interpretation footer — explains methodology + caveats */}
      <div className="text-[10px] text-neutral-500 leading-relaxed border-t border-border/40 pt-2 space-y-1">
        {agg.interpretation?.v2_methodology && (
          <div><span className="text-neutral-400">Methodology:</span> {agg.interpretation.v2_methodology}</div>
        )}
        {agg.interpretation?.in_sample_warning && (
          <div className="text-amber-300/80"><span className="text-amber-300">⚠ In-sample:</span> {agg.interpretation.in_sample_warning}</div>
        )}
        {agg.interpretation?.production_target && (
          <div><span className="text-neutral-400">Production gate:</span> {agg.interpretation.production_target}</div>
        )}
        {agg.interpretation?.denominator_note && (
          <div><span className="text-neutral-400">Denominator:</span> {agg.interpretation.denominator_note}</div>
        )}
        {/* Backwards compat — older deploys may still return these */}
        {agg.interpretation?.v2_thesis && !agg.interpretation?.v2_methodology && (
          <div className="text-amber-300/80"><span className="text-amber-300">⚠ Stale interpretation field:</span> {agg.interpretation.v2_thesis}</div>
        )}
        {agg.interpretation?.actionable_target && !agg.interpretation?.production_target && (
          <div><span className="text-neutral-400">Target:</span> {agg.interpretation.actionable_target}</div>
        )}
      </div>
    </div>
  );
}
