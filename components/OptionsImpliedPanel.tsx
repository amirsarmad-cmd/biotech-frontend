'use client';

import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import type { OptionsImplied } from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface Props {
  optionsImplied: OptionsImplied | null | undefined;
  predictedMovePct?: number | null;  // for comparison with model prediction
}

/**
 * Surfaces the ATM straddle-implied move for the upcoming catalyst expiry.
 * This is the market's actual consensus on expected move size — separate
 * from our model's predicted_move_pct (which uses reference tables).
 *
 * Methodology audit #1: addresses the gap where the reference-table predicted
 * move (e.g. 35% for Phase 3 readout) often doesn't match what options
 * are pricing in (often 10-20% even for high-conviction events).
 */
export function OptionsImpliedPanel({ optionsImplied, predictedMovePct }: Props) {
  if (!optionsImplied) {
    return null;
  }

  const impliedPct = optionsImplied.implied_move_pct;
  const dte = optionsImplied.days_to_expiry;
  const expiryDate = optionsImplied.expiry;
  const annualIv = optionsImplied.annualized_iv_pct;

  // Compare to model prediction if provided
  const hasComparison = predictedMovePct != null && predictedMovePct > 0;
  const diff = hasComparison ? predictedMovePct - impliedPct : 0;
  const modelHigher = diff > 1;
  const modelLower = diff < -1;

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-cyan-300" />
        <h3 className="text-sm font-medium text-neutral-200">Options market expectation</h3>
        <InfoTooltip
          text="ATM straddle-implied move from yfinance. Shows what the options market expects through the catalyst expiry. Uncorrelated with our model — useful as a cross-check on whether our predicted move aligns with where money is being placed."
          position="bottom"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Implied move</div>
          <div className="font-mono text-lg text-cyan-300">±{impliedPct.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Through expiry</div>
          <div className="font-mono text-sm">{expiryDate}</div>
          <div className="text-[10px] text-neutral-500">{dte} days</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Straddle premium</div>
          <div className="font-mono text-sm">${optionsImplied.straddle_premium.toFixed(2)}</div>
          <div className="text-[10px] text-neutral-500">K=${optionsImplied.atm_strike}</div>
        </div>
        {annualIv != null && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">Annualized IV</div>
            <div className="font-mono text-sm">{annualIv.toFixed(0)}%</div>
          </div>
        )}
      </div>

      {hasComparison && (
        <div className="mt-3 flex items-center gap-2 rounded border border-border/50 bg-bg/40 p-2 text-xs">
          {modelHigher ? (
            <>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-neutral-400">
                Model predicts <span className="text-emerald-300">+{predictedMovePct!.toFixed(1)}%</span>,
                {' '}options price in <span className="text-cyan-300">±{impliedPct.toFixed(1)}%</span> —
                {' '}<span className="text-amber-300">model is {Math.abs(diff).toFixed(1)}pts more bullish than the options market</span>
              </span>
            </>
          ) : modelLower ? (
            <>
              <TrendingDown className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-neutral-400">
                Model predicts <span className="text-emerald-300">+{predictedMovePct!.toFixed(1)}%</span>,
                {' '}options price in <span className="text-cyan-300">±{impliedPct.toFixed(1)}%</span> —
                {' '}<span className="text-amber-300">options market is more bullish than model</span>
              </span>
            </>
          ) : (
            <span className="text-neutral-400">
              Model predicts <span className="text-emerald-300">+{predictedMovePct!.toFixed(1)}%</span>,
              {' '}options price in <span className="text-cyan-300">±{impliedPct.toFixed(1)}%</span> — aligned
            </span>
          )}
        </div>
      )}
    </div>
  );
}
