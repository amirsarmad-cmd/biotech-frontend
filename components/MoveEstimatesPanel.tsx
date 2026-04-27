'use client';

import { TrendingUp, TrendingDown, Activity, AlertCircle, Target, Info } from 'lucide-react';
import type { MoveEstimates } from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface Props {
  moveEstimates?: MoveEstimates | null;
}

/**
 * Surfaces FOUR distinct move types as separate cards, plus a concrete
 * explainer header that tells users which one to look at.
 *
 *   1. Expected value (calibrated baseline)  — historical mean
 *   2. Expected value (stock-specific)       — rNPV-adjusted
 *   3. Options-implied                       — what the market is pricing
 *   4. Scenario up / Scenario down           — conditional outcomes
 */
export function MoveEstimatesPanel({ moveEstimates }: Props) {
  if (!moveEstimates) return null;

  const m = moveEstimates;
  const fmt = (x: number | null | undefined) =>
    x == null ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;

  // Stock-specific EV — uses scenario bounds (rNPV-adjusted)
  const evScenario = m.expected_value_scenario_pct ?? null;
  const evCalibrated = m.expected_value_move_pct;
  const usedFi = m.expected_value_used_fundamental_impact ?? false;

  // Helper: pick a color for a signed % move
  const colorFor = (v: number | null | undefined) =>
    v == null ? 'text-neutral-400' :
      v >= 0 ? 'text-emerald-300' : 'text-red-300';

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-medium text-neutral-200">Move estimates</h3>
        <InfoTooltip
          text={
            'Five different views of a catalyst move. They answer different questions and you should look at the relevant one for your decision.\n\n' +
            '• Expected Value (calibrated): N=287 historical baseline. Says what the AVERAGE Phase 3 stock did at this probability. Useful as a sanity check; not stock-specific.\n\n' +
            '• Expected Value (stock-specific): Same probability math but uses scenario bounds adjusted for THIS stock\u2019s rNPV / market-cap ratio. For NTLA-style stocks where the catalyst dwarfs market cap, this is the more meaningful number.\n\n' +
            '• Options-implied: 1-standard-deviation move priced into the ATM straddle. What sophisticated traders use to size positions.\n\n' +
            '• If positive / negative: Conditional outcome scenarios \u2014 what would happen given a clean positive or negative readout, scaled to fundamental impact. Use these for risk sizing on binary catalysts.'
          }
          position="bottom"
        />
        <span className="ml-auto text-[10px] text-neutral-500">
          @p_approval = {(m.p_approval_used * 100).toFixed(0)}%
        </span>
      </div>

      {/* EXPLAINER HEADER — which number to look at when */}
      <div className="rounded-md border border-violet-500/20 bg-violet-500/5 p-3 text-xs space-y-1.5 leading-relaxed">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-violet-300" />
          <div className="text-neutral-300">
            <span className="font-medium text-violet-200">Which number to use?</span>
            <span className="text-neutral-500"> Each answers a different question:</span>
          </div>
        </div>
        <ul className="ml-5 space-y-1 text-neutral-400">
          <li>
            <span className="text-cyan-300 font-medium">Options-implied (\u00b1{m.options_implied_move_pct?.toFixed(1) ?? '—'}%):</span>
            {' '}what the market is currently pricing in. Best estimate for day-of move on a non-extreme outcome.
          </li>
          <li>
            <span className="text-emerald-300 font-medium">If positive ({fmt(m.scenario_upside_pct)}) / If negative ({fmt(m.scenario_downside_pct)}):</span>
            {' '}what the stock should do on a clean binary outcome. Use these for position sizing.
          </li>
          <li>
            <span className="text-amber-300 font-medium">Expected value:</span>
            {' '}probability-weighted average. <span className="text-neutral-500 italic">Misleading on binaries when probability is balanced \u2014 the average can be near zero even though the stock will move sharply one way.</span>
          </li>
        </ul>
      </div>

      {/* Five-card grid: 2 EVs + options-implied + 2 scenarios */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* 1a. Expected value (calibrated) */}
        <div className="rounded-md border border-border/50 bg-bg/30 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            <Activity className="h-3 w-3" />
            EV: calibrated
            <InfoTooltip
              text={`Probability-weighted average using HISTORICAL MEAN moves from our N=287 calibration table. At p_approval=${(m.p_approval_used * 100).toFixed(0)}%, weighted average = ${(m.p_approval_used * m.reference_move.up_pct + (1 - m.p_approval_used) * m.reference_move.down_pct).toFixed(1)}%. This says "what does the average Phase 3 readout do at this probability." It does NOT adjust for THIS stock's rNPV vs market cap, so it can dramatically understate moves for stocks where the catalyst is huge.`}
              position="top"
            />
          </div>
          <div className={`mt-1 font-mono text-lg ${colorFor(evCalibrated)}`}>
            {fmt(evCalibrated)}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            historical baseline
          </div>
        </div>

        {/* 1b. Expected value (stock-specific, rNPV-adjusted) */}
        {evScenario != null && (
          <div className={`rounded-md border ${usedFi ? 'border-violet-500/30 bg-violet-500/5' : 'border-border/50 bg-bg/30'} p-3`}>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-violet-300">
              <Activity className="h-3 w-3" />
              EV: stock-specific
              <InfoTooltip
                text={
                  `Probability-weighted average using SCENARIO BOUNDS that ARE adjusted for this stock\u2019s fundamental impact (rNPV / market cap ratio). At p_approval=${(m.p_approval_used * 100).toFixed(0)}%, weighted = ${evScenario.toFixed(1)}%.\n\n` +
                  (usedFi
                    ? 'For this stock, scenarios are scaled by rNPV-vs-market-cap because the catalyst is material. This is the more meaningful EV for THIS specific name.'
                    : 'For this stock, fundamental_impact wasn\'t large enough to alter scenarios from the historical baseline, so this matches the calibrated EV.')
                }
                position="top"
              />
            </div>
            <div className={`mt-1 font-mono text-lg ${colorFor(evScenario)}`}>
              {fmt(evScenario)}
            </div>
            <div className="mt-0.5 text-[10px] text-neutral-500">
              {usedFi ? 'rNPV-adjusted' : '\u2248 calibrated'}
            </div>
          </div>
        )}

        {/* 2. Options-implied */}
        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-cyan-300">
            <Activity className="h-3 w-3" />
            Options-implied
            <InfoTooltip
              text="The 1-standard-deviation move priced into the at-the-money straddle, derived from option premiums. Symmetric (no direction). This is what sophisticated traders use to size positions. If the stock moves more than this, options buyers profit; less and option sellers profit. The market\u2019s aggregated view of how much movement is already priced in."
              position="top"
            />
          </div>
          <div className="mt-1 font-mono text-lg text-cyan-300">
            {m.options_implied_move_pct != null ? `\u00b1${m.options_implied_move_pct.toFixed(1)}%` : '—'}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            ATM straddle (1 stdev)
          </div>
        </div>

        {/* 3. Scenario upside */}
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-300/70">
            <TrendingUp className="h-3 w-3" />
            If positive
            <InfoTooltip
              text={`What the stock should do on a CLEAN positive readout, scaled by fundamental impact. ${usedFi ? 'For this stock, fundamental_impact was material so this is rNPV-driven (capped at 80% per single-day moves are rarely larger).' : 'For this stock, fundamental_impact wasn\'t large enough to scale beyond the historical baseline.'} Use this for sizing if you believe the trial will succeed.`}
              position="top"
            />
          </div>
          <div className="mt-1 font-mono text-lg text-emerald-300">
            {fmt(m.scenario_upside_pct)}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            Conditional upside
          </div>
        </div>

        {/* 4. Scenario downside */}
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-red-300/70">
            <TrendingDown className="h-3 w-3" />
            If negative
            <InfoTooltip
              text="What the stock should do on a clean negative readout. For binary catalysts where the asset is the company\u2019s value, downside can approach the cash-floor — equity value once you strip out the asset NPV. Use this for stop-loss / position-sizing on the bear case."
              position="top"
            />
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
