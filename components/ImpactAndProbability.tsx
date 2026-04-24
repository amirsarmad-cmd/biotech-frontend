'use client';

import type { NPVFull } from '@/lib/api';
import { formatPercent, formatCurrency } from '@/lib/utils';

export function StockImpactPanel({ npv }: { npv: NPVFull }) {
  const fund = npv.fundamental_impact_pct;
  const impl = npv.implied_move_pct;
  const full = npv.full_approval_pct_theoretical;
  const baselineDays = npv.baseline_days;

  if (fund == null && impl == null && full == null) return null;

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <h3 className="mb-4 text-lg">
        Stock Impact <span className="text-xs font-normal text-neutral-500">Section 2</span>
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          label="NPV / Market Cap"
          value={fund != null ? `${fund.toFixed(1)}%` : '—'}
          help="Max fundamental upside from this drug"
        />
        <Metric
          label={`Priced-in (past ${baselineDays ?? 30}d)`}
          value={impl != null ? formatPercent(impl) : '—'}
          help="Market's anticipation already reflected"
          color={impl == null ? undefined : impl > 0 ? 'emerald' : 'red'}
        />
        <Metric
          label="Full theoretical move"
          value={full != null ? `${full.toFixed(1)}%` : '—'}
          help="What the stock would move if nothing was priced in"
        />
      </div>

      {fund != null && impl != null && (
        <div className="mt-4 text-sm text-neutral-400 leading-relaxed">
          Stock could fundamentally move up to <strong className="text-neutral-200">{fund.toFixed(1)}%</strong>{' '}
          on full approval + commercial success. Market has already priced in{' '}
          <strong className={impl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatPercent(impl)}</strong>{' '}
          over the past {baselineDays ?? 30} days. Remaining upside on approval:{' '}
          <strong className="text-emerald-400">{npv.upside_pct != null ? formatPercent(npv.upside_pct) : '—'}</strong>.
        </div>
      )}

      {npv.sentiment_notes && npv.sentiment_notes.length > 0 && (
        <div className="mt-4 rounded-md border border-border bg-bg/50 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Sentiment adjustments</div>
          <ul className="space-y-1 text-xs text-neutral-400">
            {npv.sentiment_notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
          {npv.sentiment_adj_factor != null && (
            <div className="mt-1 text-xs text-neutral-500 font-mono">adj factor: {npv.sentiment_adj_factor.toFixed(3)}×</div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProbabilityMathPanel({ npv }: { npv: NPVFull }) {
  if (npv.p_approval == null && npv.p_commercial == null) return null;
  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <h3 className="mb-4 text-lg">
        Probability Math <span className="text-xs font-normal text-neutral-500">Section 3</span>
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          label="P(approval)"
          value={npv.p_approval != null ? `${(npv.p_approval * 100).toFixed(0)}%` : '—'}
          help="From catalyst probability + AI triangulation"
          color={npv.p_approval != null && npv.p_approval >= 0.7 ? 'emerald' : npv.p_approval != null && npv.p_approval >= 0.5 ? 'amber' : 'red'}
        />
        <Metric
          label="P(commercial | approval)"
          value={npv.p_commercial != null ? `${(npv.p_commercial * 100).toFixed(0)}%` : '—'}
          help="Will drug sell well IF approved"
        />
        <Metric
          label="Combined P(value realized)"
          value={npv.combined_prob != null ? `${(npv.combined_prob * 100).toFixed(0)}%` : '—'}
          help="Overall likelihood of drug-NPV materializing"
          color="emerald"
        />
      </div>
      {npv.p_approval != null && npv.approval != null && npv.rejection != null && npv.expected != null && (
        <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-bg/60 p-3 text-xs text-neutral-300 font-mono">
{`Expected = P(approval) × approval + (1 − P(approval)) × rejection
         = ${(npv.p_approval * 100).toFixed(0)}% × ${formatCurrency(npv.approval)} + ${((1 - npv.p_approval) * 100).toFixed(0)}% × ${formatCurrency(npv.rejection)}
         = ${formatCurrency(npv.expected)}`}
        </pre>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  help,
  color,
}: {
  label: string;
  value: string;
  help?: string;
  color?: 'emerald' | 'red' | 'amber';
}) {
  const valueClass =
    color === 'emerald' ? 'text-emerald-400'
    : color === 'red' ? 'text-red-400'
    : color === 'amber' ? 'text-amber-400'
    : 'text-neutral-100';
  return (
    <div className="rounded-md border border-border bg-bg/50 p-4" title={help}>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueClass}`}>{value}</div>
      {help && <div className="mt-0.5 text-xs text-neutral-500">{help}</div>}
    </div>
  );
}
