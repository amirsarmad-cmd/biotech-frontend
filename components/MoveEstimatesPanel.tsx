'use client';

import { TrendingUp, TrendingDown, Activity, AlertCircle, Target, Info, BookOpen } from 'lucide-react';
import type { MoveEstimates } from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface Props {
  moveEstimates?: MoveEstimates | null;
}

/**
 * Five views of how a stock might move on a catalyst, ordered most→least
 * actionable for retail decision-making:
 *
 *   1. Options-implied (cyan)        — what the market is pricing right now
 *   2. If positive (emerald)         — clean upside scenario
 *   3. If negative (red)             — clean downside scenario
 *   4. EV: stock-specific (violet)   — probability-weighted using THIS stock's fundamentals
 *   5. EV: calibrated (amber)        — probability-weighted using historical mean
 *
 * The order matters: most retail users should look at options-implied first,
 * scenarios for sizing, EVs only for sanity-checking. The original layout put
 * EV first, which led users to act on a misleading number on binary catalysts.
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
  const p = m.p_approval_used;
  const pPct = (p * 100).toFixed(0);
  const ref = m.reference_move;

  const colorFor = (v: number | null | undefined) =>
    v == null ? 'text-neutral-400' :
      v >= 0 ? 'text-emerald-300' : 'text-red-300';

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-medium text-neutral-200">Move estimates</h3>
        <span className="ml-auto text-[10px] text-neutral-500">
          @ p_approval = {pPct}%
        </span>
      </div>

      {/* PROMINENT EXPLAINER HEADER — front-and-center so retail users
          can't miss which number to use for which decision. Violet panel
          to draw the eye. */}
      <div className="rounded-md border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-4">
        <div className="flex items-start gap-2 mb-2">
          <BookOpen className="h-4 w-4 flex-shrink-0 mt-0.5 text-violet-300" />
          <div>
            <div className="text-sm font-medium text-violet-100">
              How to read these numbers
            </div>
            <div className="text-[11px] text-neutral-400">
              Each card answers a different question. Look at the right one for your decision:
            </div>
          </div>
        </div>
        <div className="ml-6 space-y-1.5 text-xs">
          <div className="flex gap-2">
            <span className="text-cyan-300 font-medium min-w-[150px]">📊 Day-of trade?</span>
            <span className="text-neutral-300">
              Use <span className="text-cyan-300 font-medium">Options-implied (±{m.options_implied_move_pct?.toFixed(1) ?? '—'}%)</span>
              {' '}— what the market actually thinks will happen.
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-emerald-300 font-medium min-w-[150px]">🎯 Position sizing?</span>
            <span className="text-neutral-300">
              Use <span className="text-emerald-300 font-medium">If positive ({fmt(m.scenario_upside_pct)})</span> /
              {' '}<span className="text-red-300 font-medium">If negative ({fmt(m.scenario_downside_pct)})</span>
              {' '}— set stops &amp; size by these.
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-amber-300 font-medium min-w-[150px]">⚠️ Expected value?</span>
            <span className="text-neutral-300 italic">
              Misleading on binaries. At p={pPct}%, the EV math says +{evCalibrated.toFixed(1)}%
              {' '}but the stock will likely move sharply one direction (+80% or −80%), not a small average.
            </span>
          </div>
        </div>
      </div>

      {/* 5-CARD GRID — reordered so most actionable comes first */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

        {/* 1. Options-implied (FIRST — most actionable for trading) */}
        <div className="rounded-md border border-cyan-500/40 bg-cyan-500/10 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-cyan-300">
            <Activity className="h-3 w-3" />
            Options-implied
            <InfoTooltip
              text={`The 1-standard-deviation move priced into the at-the-money straddle, derived from option premiums. Symmetric (no direction).\n\nWhat it tells you: the market currently expects ~${m.options_implied_move_pct?.toFixed(1) ?? '—'}% absolute move by the next options expiration.\n\nWho should look at this: anyone considering an actual trade. If you think the stock will move MORE than this, calls or straddles look attractive. If LESS, options sellers profit.\n\nWhy it's the most reliable single number: aggregates the views of all options market participants in real time. Doesn't require modeling the catalyst yourself.`}
              position="top"
            />
          </div>
          <div className="mt-1 font-mono text-lg text-cyan-300">
            {m.options_implied_move_pct != null ? `±${m.options_implied_move_pct.toFixed(1)}%` : '—'}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            ATM straddle (1σ)
          </div>
        </div>

        {/* 2. Scenario upside */}
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-300">
            <TrendingUp className="h-3 w-3" />
            If positive
            <InfoTooltip
              text={`What the stock should do on a CLEAN positive readout, scaled by fundamental impact (rNPV vs market cap).\n\n${usedFi
                ? `For this stock, fundamental impact was material so the upside is rNPV-driven (capped at +80% — single-day moves rarely exceed this).`
                : `For this stock, fundamental impact wasn't large enough vs market cap to scale beyond the historical baseline of +${ref.up_pct.toFixed(1)}%.`}\n\nUse this for: position sizing if you believe the trial will succeed. If you think there's a 70% chance of success, you might size to lose ~30% × scenario_downside without ruining your portfolio.`}
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

        {/* 3. Scenario downside */}
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-red-300">
            <TrendingDown className="h-3 w-3" />
            If negative
            <InfoTooltip
              text={`What the stock should do on a CLEAN negative readout.\n\nFor binary catalysts where the asset is most of the company's value, downside can approach the cash-floor — what's left after stripping out the failed-asset NPV. For NTLA-style stocks where the catalyst dwarfs market cap, this is typically capped at -80% (entire program washing out leaves only platform/cash value).\n\nUse this for: stop-loss placement and the BAD case in your position-sizing math. If you can't survive scenario_downside × position_size, the position is too large.`}
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

        {/* 4. Expected value (stock-specific, rNPV-adjusted) — show only if available */}
        {evScenario != null ? (
          <div className={`rounded-md border ${usedFi ? 'border-violet-500/40 bg-violet-500/10' : 'border-border/50 bg-bg/30'} p-3`}>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-violet-300">
              <Activity className="h-3 w-3" />
              EV: stock-specific
              <InfoTooltip
                text={
                  `Probability-weighted average using THIS STOCK'S scenario bounds (which are scaled by rNPV vs market cap).\n\nMath: ${(p * 100).toFixed(0)}% × ${fmt(m.scenario_upside_pct)} + ${((1 - p) * 100).toFixed(0)}% × ${fmt(m.scenario_downside_pct)} = ${fmt(evScenario)}\n\n` +
                  (usedFi
                    ? `For this stock, fundamental impact was material so scenarios are rNPV-driven, not historical-mean-driven. This is the more honest EV for THIS specific name — at p=${pPct}%, the probability-weighted outcome is ${fmt(evScenario)}.`
                    : `For this stock, fundamental impact wasn't large enough to alter scenarios from the historical baseline, so this matches the calibrated EV.`)
                }
                position="top"
              />
            </div>
            <div className={`mt-1 font-mono text-lg ${colorFor(evScenario)}`}>
              {fmt(evScenario)}
            </div>
            <div className="mt-0.5 text-[10px] text-neutral-500">
              {usedFi ? 'rNPV-adjusted' : '≈ calibrated'}
            </div>
          </div>
        ) : (
          // Backend hasn't sent this field yet (cached pre-deploy) — placeholder
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-300/70">
              <Activity className="h-3 w-3" />
              EV: stock-specific
              <InfoTooltip
                text="Stock-specific EV (probability-weighted using THIS stock's rNPV-derived scenarios) is being computed. If this stays empty, force-refresh the page to bust the cache."
                position="top"
              />
            </div>
            <div className="mt-1 font-mono text-sm text-neutral-500">
              computing…
            </div>
          </div>
        )}

        {/* 5. Expected value (calibrated, historical) */}
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-300">
            <Activity className="h-3 w-3" />
            EV: calibrated
            <InfoTooltip
              text={`Probability-weighted average using HISTORICAL MEAN moves from N=287 calibration table.\n\nMath: ${(p * 100).toFixed(0)}% × ${ref.up_pct.toFixed(1)}% + ${((1 - p) * 100).toFixed(0)}% × ${ref.down_pct.toFixed(1)}% = ${evCalibrated.toFixed(1)}%\n\nThe up (+${ref.up_pct.toFixed(1)}%) and down (${ref.down_pct.toFixed(1)}%) come from the AVERAGE move of past ${(m.catalyst_type || 'similar')} catalysts.\n\nWHY THIS UNDERSTATES BIG CATALYSTS: For stocks where rNPV >> market cap (like NTLA where the drug is worth ~7× the company), the AVERAGE historical move dramatically understates what should happen. Use 'EV: stock-specific' instead for those names.`}
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
      </div>

      {/* Interpretation */}
      <div className="text-xs text-neutral-400">{m.interpretation}</div>

      {/* Warning */}
      {m.warning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-300" />
          <span className="text-amber-100/80">{m.warning}</span>
        </div>
      )}

      {/* Methodology footer — explains the 'is this correct?' question */}
      <details className="text-[10px] text-neutral-500">
        <summary className="cursor-pointer hover:text-neutral-300">
          Methodology: Why we show two Expected Values
        </summary>
        <div className="mt-2 space-y-1.5 leading-relaxed pl-2 border-l border-border/40">
          <p>
            <span className="text-amber-300">EV: calibrated</span> uses the formula
            {' '}<code className="text-neutral-300">p × hist_up + (1−p) × hist_down</code>
            {' '}where hist_up/down come from the AVERAGE move of N={ref.calibration_source?.match(/N=(\d+)/)?.[1] ?? '287'} historical {m.catalyst_type ?? 'similar'} outcomes.
          </p>
          <p>
            <span className="text-violet-300">EV: stock-specific</span> uses the same probability formula but with SCENARIO bounds tailored to THIS stock — specifically, the rNPV-adjusted upside/downside that account for catalyst materiality vs market cap.
          </p>
          <p>
            <span className="text-neutral-400">Why the gap can be huge:</span> for stocks where rNPV {'>>'} market cap (e.g. small biotechs with one Phase 3 drug), the historical average doesn't apply. Calibrated EV says +3%; stock-specific EV says +80% — both are mathematically correct, but they answer different questions.
          </p>
          <p>
            <span className="text-neutral-400">Reference table:</span> {ref.calibration_source ?? `N=287 historical outcomes`} (up {ref.up_pct.toFixed(1)}% / down {ref.down_pct.toFixed(1)}%).
          </p>
        </div>
      </details>
    </div>
  );
}
