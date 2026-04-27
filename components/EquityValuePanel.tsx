'use client';

import { Wallet, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import type { EquityValue, CapitalStructure } from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface Props {
  equityValue?: EquityValue | null;
  capitalStructure?: CapitalStructure | null;
  currentMarketCapM?: number | null;
}

const fmtM = (v: number | null | undefined) =>
  v == null ? '—' : v >= 1000 ? `$${(v / 1000).toFixed(2)}B` : `$${v.toFixed(0)}M`;
const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/**
 * Surfaces the cash/debt/dilution-adjusted equity value (ChatGPT critique #5).
 *
 * Replaces the naive "rNPV / market_cap = upside" heuristic with proper
 * accounting:
 *   equity_value = rNPV − total_debt + total_cash
 *   per_share = equity_value × (1 − projected_dilution) / shares_outstanding
 *
 * Data is pulled live from SEC EDGAR (us-gaap XBRL facts).
 */
export function EquityValuePanel({ equityValue, capitalStructure, currentMarketCapM }: Props) {
  if (!equityValue || !capitalStructure) return null;

  const ev = equityValue;
  const cs = capitalStructure;
  const perShareUsd = ev.per_share_value_usd;
  const upsidePct = currentMarketCapM && ev.equity_value_post_dilution_m
    ? ((ev.equity_value_post_dilution_m / currentMarketCapM) - 1) * 100
    : null;

  const runwayTone =
    cs.cash_runway_months == null ? 'neutral' :
    cs.cash_runway_months < 6 ? 'red' :
    cs.cash_runway_months < 12 ? 'amber' :
    cs.cash_runway_months < 24 ? 'violet' :
    'green';
  const runwayClass = {
    red: 'text-red-300',
    amber: 'text-amber-300',
    violet: 'text-violet-300',
    green: 'text-emerald-300',
    neutral: 'text-neutral-300',
  }[runwayTone];

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-medium text-neutral-200">Equity value (capital-structure adjusted)</h3>
        <InfoTooltip
          text="Replaces 'rNPV ÷ market cap = upside' with proper accounting. Equity value = rNPV − debt + cash, then haircut by projected dilution if cash runway is short. Per-share = equity / shares outstanding. Data pulled live from SEC EDGAR balance sheet."
          position="bottom"
        />
        {ev.as_of_filing && (
          <span className="ml-auto text-[10px] text-neutral-500">
            SEC filing: {ev.as_of_filing}
          </span>
        )}
      </div>

      {/* Top row: walkthrough of equity value math */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border/50 bg-bg/30 p-3">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Asset rNPV</div>
          <div className="mt-1 font-mono text-base text-violet-300">{fmtM(ev.rnpv_m)}</div>
        </div>
        <div className="rounded-md border border-border/50 bg-bg/30 p-3">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">+ Net cash</div>
          <div className={`mt-1 font-mono text-base ${ev.net_cash_adjustment_m >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {ev.net_cash_adjustment_m >= 0 ? '+' : ''}{fmtM(ev.net_cash_adjustment_m)}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            cash {fmtM(ev.total_cash_m)} − debt {fmtM(ev.total_debt_m)}
          </div>
        </div>
        <div className="rounded-md border border-border/50 bg-bg/30 p-3">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">− Dilution</div>
          <div className={`mt-1 font-mono text-base ${ev.projected_dilution_pct > 0 ? 'text-amber-300' : 'text-neutral-300'}`}>
            {ev.projected_dilution_pct > 0 ? `−${ev.projected_dilution_pct.toFixed(1)}%` : '—'}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            {ev.dilution_source === 'runway_projection' ? `proj raise ${fmtM(ev.projected_raise_m)}` :
             ev.dilution_source === 'user_override' ? 'user override' :
             'none'}
          </div>
        </div>
        <div className="rounded-md border border-violet-500/30 bg-violet-500/10 p-3">
          <div className="text-[10px] uppercase tracking-wide text-violet-200">Equity value</div>
          <div className="mt-1 font-mono text-lg font-semibold text-violet-100">
            {fmtM(ev.equity_value_post_dilution_m)}
          </div>
          {perShareUsd != null && (
            <div className="mt-0.5 text-[10px] text-violet-200/70">
              {ev.shares_outstanding_m?.toFixed(1)}M shares · ${perShareUsd.toFixed(2)}/share
            </div>
          )}
        </div>
      </div>

      {/* Implied upside vs current market cap */}
      {upsidePct != null && currentMarketCapM && (
        <div className="rounded-md border border-border/30 bg-bg/20 p-3 flex items-center gap-3">
          {upsidePct >= 0 ? (
            <TrendingUp className="h-4 w-4 text-emerald-300" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-300" />
          )}
          <div className="flex-1">
            <div className="text-xs text-neutral-400">vs current market cap of {fmtM(currentMarketCapM)}</div>
            <div className={`font-mono text-base ${upsidePct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {fmtPct(upsidePct)} implied upside
            </div>
          </div>
        </div>
      )}

      {/* Cash runway / financing posture */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Cash runway</div>
          <div className={`mt-1 font-mono ${runwayClass}`}>
            {cs.cash_runway_months != null ? `${cs.cash_runway_months.toFixed(1)} months` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Monthly burn</div>
          <div className="mt-1 font-mono text-neutral-300">
            {ev.monthly_burn_m != null ? `${fmtM(ev.monthly_burn_m)}/mo` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Financing posture</div>
          <div className={`mt-1 font-mono text-xs ${ev.needs_financing_within_12mo ? 'text-amber-300' : 'text-emerald-300'}`}>
            {ev.needs_financing_within_12mo ? 'Raise likely <12mo' : 'Runway adequate'}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {ev.warnings && ev.warnings.length > 0 && (
        <div className="space-y-1">
          {ev.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-300" />
              <span className="text-amber-100/80">{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-neutral-600">
        Source: SEC EDGAR (us-gaap XBRL facts) · provenance: {ev._provenance}
      </div>
    </div>
  );
}
