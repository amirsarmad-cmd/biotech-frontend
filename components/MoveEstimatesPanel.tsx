'use client';

import { TrendingUp, TrendingDown, Activity, AlertCircle, Target } from 'lucide-react';
import type { MoveEstimates } from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface Props {
  moveEstimates?: MoveEstimates | null;
}

/**
 * Surfaces the FOUR distinct move types as separate, side-by-side cards.
 *
 * Per ChatGPT critique: don't collapse expected-value, options-implied,
 * scenario, and reference-table moves into one "predicted move" — they
 * answer different questions and users should see them separately.
 *
 *   1. Expected value (E[X]) — probability-weighted return
 *   2. Options-implied — what the market is pricing
 *   3. Scenario up/down — bounded conditional outcomes
 *   4. Reference table — historical mean per outcome
 */
export function MoveEstimatesPanel({ moveEstimates }: Props) {
  if (!moveEstimates) return null;

  const m = moveEstimates;
  const fmt = (x: number | null | undefined) =>
    x == null ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-medium text-neutral-200">Move estimates</h3>
        <InfoTooltip
          text={
            'Four distinct ways to think about a catalyst event move. They answer different questions and you should look at all of them, not just one. ' +
            'Expected value can be near zero on a 50/50 binary even though the stock will likely move sharply in one direction. ' +
            'Options-implied is what sophisticated traders use for sizing. ' +
            'Scenarios are useful for stress-testing — what if it works vs what if it fails. ' +
            'Reference table is the calibration baseline from N=287 historical outcomes.'
          }
          position="bottom"
        />
        <span className="ml-auto text-[10px] text-neutral-500">
          @p_approval = {(m.p_approval_used * 100).toFixed(0)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* 1. Expected value */}
        <div className="rounded-md border border-border/50 bg-bg/30 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            <Activity className="h-3 w-3" />
            Expected value
          </div>
          <div className={`mt-1 font-mono text-lg ${m.expected_value_move_pct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {fmt(m.expected_value_move_pct)}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            E[X] = p × up + (1−p) × down
          </div>
        </div>

        {/* 2. Options-implied */}
        <div className="rounded-md border border-border/50 bg-bg/30 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            <Activity className="h-3 w-3" />
            Options-implied
          </div>
          <div className="mt-1 font-mono text-lg text-cyan-300">
            {m.options_implied_move_pct != null ? `±${m.options_implied_move_pct.toFixed(1)}%` : '—'}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            ATM straddle (1 stdev)
          </div>
        </div>

        {/* 3. Scenario upside */}
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-300/70">
            <TrendingUp className="h-3 w-3" />
            If positive
          </div>
          <div className="mt-1 font-mono text-lg text-emerald-300">
            {fmt(m.scenario_upside_pct)}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            Conditional upside
          </div>
        </div>

        {/* 4. Scenario downside */}
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-red-300/70">
            <TrendingDown className="h-3 w-3" />
            If negative
          </div>
          <div className="mt-1 font-mono text-lg text-red-300">
            {fmt(m.scenario_downside_pct)}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            Conditional downside
          </div>
        </div>
      </div>

      <div className="text-xs text-neutral-400">{m.interpretation}</div>

      {m.warning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-300" />
          <span className="text-amber-100/80">{m.warning}</span>
        </div>
      )}

      <div className="text-[10px] text-neutral-600">
        Reference move (N=287 calibration): up {m.reference_move.up_pct.toFixed(1)}% / down {m.reference_move.down_pct.toFixed(1)}%
      </div>
    </div>
  );
}
