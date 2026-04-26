'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { InfoTooltip } from './tooltips';
import { HELP } from '@/lib/help-text';

type RiskFactorKey =
  | 'litigation' | 'fda_history' | 'sec_short' | 'insider_sell'
  | 'going_concern' | 'patent_cliff' | 'governance';

const FACTOR_META: Record<RiskFactorKey, { icon: string; label: string }> = {
  litigation:    { icon: '⚖️', label: 'Litigation' },
  fda_history:   { icon: '🏛', label: 'FDA History' },
  sec_short:     { icon: '📉', label: 'SEC / Short Reports' },
  insider_sell:  { icon: '👔', label: 'Insider Selling' },
  going_concern: { icon: '💸', label: 'Going Concern' },
  patent_cliff:  { icon: '📆', label: 'Patent Cliff' },
  governance:    { icon: '🏢', label: 'Governance' },
};

interface Props {
  breakdown?: Record<string, unknown> | null;
  totalDiscountPct?: number;
  rawNpvB?: number;
  adjustedNpvB?: number;
}

export function RiskFactorsPanel({ breakdown, totalDiscountPct, rawNpvB, adjustedNpvB }: Props) {
  if (!breakdown) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h3 className="mb-2 text-lg">Adverse Risk Factors <InfoTooltip text={HELP.stockDetail.section_2b_risks} position="bottom" /></h3>
        <p className="text-sm text-neutral-500">Risk factor analysis not available.</p>
      </div>
    );
  }

  const b = breakdown as Record<string, unknown>;
  const err = b.error as string | undefined;
  if (err) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h3 className="mb-2 text-lg">Adverse Risk Factors <InfoTooltip text={HELP.stockDetail.section_2b_risks} position="bottom" /></h3>
        <p className="text-sm text-amber-400/80">{err.slice(0, 200)}</p>
      </div>
    );
  }

  const hasSignificant = (totalDiscountPct ?? 0) > 0.5;

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg">Adverse Risk Factors <span className="text-xs font-normal text-neutral-500">Section 2B</span></h3>
        {totalDiscountPct != null && (
          <span className={`text-sm font-mono ${hasSignificant ? 'text-amber-400' : 'text-emerald-400'}`}>
            −{totalDiscountPct.toFixed(1)}% total
          </span>
        )}
      </div>

      {hasSignificant && rawNpvB != null && adjustedNpvB != null && (
        <div className="mb-4 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
          <span className="text-amber-200">
            Drug NPV discounted: ${rawNpvB.toFixed(2)}B raw → <strong>${adjustedNpvB.toFixed(2)}B adjusted</strong>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(FACTOR_META) as RiskFactorKey[]).map((k) => {
          const val = (b[k] as number | undefined) ?? 0;
          const rationale = (b[`${k}_rationale`] as string | undefined) ?? '';
          const triggered = val > 0.01;
          return (
            <div
              key={k}
              className={`rounded-md border p-3 ${
                triggered ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-bg/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-base">{FACTOR_META[k].icon}</span>
                  <span className="font-medium text-neutral-200">{FACTOR_META[k].label}</span>
                </div>
                {triggered ? (
                  <span className="flex items-center gap-1 text-xs font-mono text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    −{(val * 100).toFixed(1)}%
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" /> clean
                  </span>
                )}
              </div>
              {rationale && (
                <p className={`mt-1 text-xs leading-relaxed ${triggered ? 'text-neutral-300' : 'text-neutral-500'}`}>{rationale}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
