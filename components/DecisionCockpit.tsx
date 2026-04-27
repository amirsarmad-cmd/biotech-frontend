'use client';

import { useQuery } from '@tanstack/react-query';
import { Target, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Sparkles, Calendar, ChevronRight } from 'lucide-react';
import {
  analyzeNpv,
  type NPVAnalyzeResponse,
  type Catalyst,
  type StockDetail,
} from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface Props {
  ticker: string;
  stock: StockDetail;
}

const fmtUSD = (v: number | null | undefined) =>
  v == null ? '—' :
    v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` :
      v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` :
        v >= 1000 ? `$${(v / 1000).toFixed(0)}K` :
          `$${v.toFixed(0)}`;
const fmtUsd = (v: number | null | undefined) => v == null ? '—' : `$${v.toFixed(2)}`;
const fmtPct = (v: number | null | undefined) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`;

/**
 * Top-of-page Decision Cockpit per ChatGPT pass-4 critique.
 *
 * Answers the four questions a retail user actually asks:
 *   1. What's the catalyst — when, what, how big?
 *   2. What's it worth — fair value per share + upside vs current price?
 *   3. What's the trade — options-implied move + scenario range?
 *   4. What's the risk — biggest single risk + dilution + going-concern flag
 *
 * Plus a verdict:
 *   ATTRACTIVE / NEUTRAL / AVOID with confidence score
 *
 * Implementation philosophy:
 *   - Pulls from same analyzeNpv query as RnpvBreakdownV2 (deduped via React Query)
 *   - Doesn't re-render the whole detail page; just summarizes
 *   - Verdict is derived: rNPV-vs-market-cap + risk_discount + confidence
 */
export function DecisionCockpit({ ticker, stock }: Props) {
  const npvCatalyst = stock.npv_catalyst ?? stock.primary_catalyst ?? null;
  const marketCapM = stock.market_cap_m ?? null;

  const npvQ = useQuery({
    // SAME query key as RnpvBreakdownV2 — React Query dedupes
    queryKey: [
      'analyze-npv-v2',
      ticker,
      npvCatalyst?.type ?? (stock.primary_catalyst?.type),
      npvCatalyst?.date ?? (stock.primary_catalyst?.date),
      npvCatalyst?.drug_name,
      undefined, undefined, false,
    ],
    queryFn: async (): Promise<NPVAnalyzeResponse> => analyzeNpv({
      ticker,
      catalyst_type: npvCatalyst?.type || stock.primary_catalyst?.type || 'FDA Decision',
      market_cap_m: marketCapM ?? undefined,
      p_approval: npvCatalyst?.probability ?? stock.primary_catalyst?.probability,
      drug_name_override: npvCatalyst?.drug_name,
      description_override: npvCatalyst?.description,
    }),
    staleTime: 60 * 60_000,
    enabled: !!ticker && !!marketCapM && marketCapM > 0,
  });

  const data = npvQ.data;
  const e2 = data?.economics_v2 ?? null;
  const rnpv = data?.rnpv ?? null;
  const ev = data?.equity_value ?? null;
  const cap = data?.capital_structure ?? null;
  const moves = data?.move_estimates ?? null;
  const dilution = data?.dilution_capacity ?? null;
  const audit = data?.source_precedence_audit ?? null;

  const cat = npvCatalyst ?? stock.primary_catalyst;
  const daysOut = cat?.date ? Math.ceil((new Date(cat.date).getTime() - Date.now()) / 86_400_000) : null;
  const drugName = cat?.drug_name ?? cat?.description?.slice(0, 40) ?? null;

  // Fair value
  const equityPostM = ev?.equity_value_post_dilution_m ?? null;
  const perShareFair = ev?.per_share_value_usd ?? null;
  const currentPrice = stock.current_price ?? null;
  const upsideToFair = perShareFair && currentPrice ? ((perShareFair / currentPrice) - 1) * 100 : null;

  // Trading move
  const optionsImplied = moves?.options_implied_move_pct ?? null;
  const scenarioUp = moves?.scenario_upside_pct ?? null;
  const scenarioDown = moves?.scenario_downside_pct ?? null;
  const moveWarning = moves?.warning ?? null;

  // Risk identification — pick the most material
  const risks: Array<{ label: string; severity: 'high' | 'med' | 'low'; detail: string }> = [];
  if (cap?.cash_runway_months != null && cap.cash_runway_months < 12) {
    risks.push({
      label: `Cash runway ${cap.cash_runway_months.toFixed(1)} months`,
      severity: cap.cash_runway_months < 6 ? 'high' : 'med',
      detail: `Likely raise within ${cap.cash_runway_months < 6 ? '3-6' : '6-12'} months at potentially distressed terms.`,
    });
  }
  if ((dilution?.atm_facility?.exists) || (dilution?.shelf_registration?.exists)) {
    const cap_usd = dilution?.estimated_dilution_capacity_usd ?? 0;
    risks.push({
      label: 'Active dilution capacity',
      severity: 'med',
      detail: dilution?.atm_facility?.exists
        ? `ATM facility lets company sell stock without pre-announcement. ${cap_usd > 0 ? `~${fmtUSD(cap_usd)} estimated capacity.` : ''}`
        : `Shelf registration filed; can issue stock with short notice.`,
    });
  }
  const dropoff = e2?.loe_dropoff_pct;
  const patExp = e2?.patent_expiry_date;
  if (patExp && new Date(patExp).getFullYear() - new Date().getFullYear() < 5) {
    risks.push({
      label: `Patent expiry ${new Date(patExp).getFullYear()}`,
      severity: 'med',
      detail: `Patent loses ~${dropoff != null ? (dropoff * 100).toFixed(0) : '90'}% revenue post-LOE; <5 years until expiration.`,
    });
  }
  if (moveWarning) {
    risks.push({ label: 'Binary outcome', severity: 'med', detail: moveWarning });
  }
  // Catalyst risk = single-event binary risk
  if (cat?.type && (cat.type.includes('Phase') || cat.type.includes('FDA'))) {
    const pApp = (data?.probability_resolution?.p_approval_used ?? cat.probability ?? 0.5) * 100;
    if (pApp < 70) {
      risks.push({
        label: `${cat.type} outcome risk`,
        severity: pApp < 40 ? 'high' : 'med',
        detail: `~${pApp.toFixed(0)}% probability of positive outcome. Stock likely moves sharply in one direction on the binary.`,
      });
    }
  }
  const topRisk = risks[0] ?? null;

  // ----------- VERDICT MATH -----------
  // Score components (each -2 to +2 except confidence which scales final):
  //   1. Upside vs current price: +2 if >100%, +1 if >25%, 0 if -25-25%, -1 if <-25%, -2 if <-50%
  //   2. Confidence in fair value: +1 if confidence_score > 0.7, 0 if 0.4-0.7, -1 if < 0.4
  //   3. Risk: -1 per high-severity risk, -0.5 per med
  //   4. Catalyst proximity: bullish if event in 30-90 days, neutral otherwise
  let verdictScore = 0;
  const verdictReasons: string[] = [];
  if (upsideToFair != null) {
    if (upsideToFair > 100) { verdictScore += 2; verdictReasons.push(`+${upsideToFair.toFixed(0)}% upside to fair value`); }
    else if (upsideToFair > 25) { verdictScore += 1; verdictReasons.push(`+${upsideToFair.toFixed(0)}% upside to fair value`); }
    else if (upsideToFair < -50) { verdictScore -= 2; verdictReasons.push(`${upsideToFair.toFixed(0)}% below fair value (overvalued)`); }
    else if (upsideToFair < -25) { verdictScore -= 1; verdictReasons.push(`${upsideToFair.toFixed(0)}% below fair value`); }
  }
  const conf = e2?.confidence_score ?? null;
  if (conf != null) {
    if (conf > 0.7) { verdictScore += 0.5; verdictReasons.push(`High data confidence (${(conf * 100).toFixed(0)}%)`); }
    else if (conf < 0.4) { verdictScore -= 1; verdictReasons.push(`Low data confidence (${(conf * 100).toFixed(0)}%) — analysis is partly LLM inference`); }
  }
  const highRisks = risks.filter(r => r.severity === 'high').length;
  const medRisks = risks.filter(r => r.severity === 'med').length;
  verdictScore -= highRisks * 1.5 + medRisks * 0.5;
  if (highRisks > 0) verdictReasons.push(`${highRisks} high-severity risk${highRisks > 1 ? 's' : ''}`);
  if (medRisks > 0) verdictReasons.push(`${medRisks} medium risk${medRisks > 1 ? 's' : ''}`);

  let verdict: 'attractive' | 'neutral' | 'avoid' = 'neutral';
  if (verdictScore >= 1.5) verdict = 'attractive';
  else if (verdictScore <= -1.5) verdict = 'avoid';

  const verdictTone = verdict === 'attractive' ? {
    border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-300', label: 'ATTRACTIVE',
  } : verdict === 'avoid' ? {
    border: 'border-red-500/40', bg: 'bg-red-500/10', text: 'text-red-300', label: 'AVOID',
  } : {
    border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-300', label: 'NEUTRAL',
  };

  if (npvQ.isLoading && !data) {
    return (
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
        <div className="flex items-center gap-2 text-sm text-cyan-200">
          <Target className="h-4 w-4 animate-pulse" />
          Building decision summary…
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-medium text-neutral-200">Decision Cockpit</h3>
        <InfoTooltip
          text={
            'A summary of the four things that matter for an investment decision: (1) the catalyst, (2) fair-value vs current price using rNPV adjusted for cash, debt, and dilution, (3) the trading setup including options-implied move, (4) the biggest single risk. Verdict is derived from upside-to-fair-value, data confidence, and risk count. Click into the panels below for the full evidence behind each box.'
          }
          position="bottom"
        />
        <span className="ml-auto text-[10px] text-neutral-500">
          {drugName ?? '—'}
        </span>
      </div>

      {/* 4-box grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* 1. Catalyst */}
        <div className="rounded-md border border-border bg-bg-card p-3 space-y-1">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            <Calendar className="h-3 w-3" />
            Main catalyst
            {cat?.materiality?.score != null && (
              <span className="ml-auto text-[9px] font-mono text-violet-300/80"
                    title={`Materiality score: tier ${(cat.materiality.tier_score * 100).toFixed(0)}% × proximity ${(cat.materiality.proximity_score * 100).toFixed(0)}% × probability ${(cat.materiality.probability_score * 100).toFixed(0)}% × binary ${(cat.materiality.binary_score * 100).toFixed(0)}%`}>
                {(cat.materiality.score * 100).toFixed(0)}% mat
              </span>
            )}
          </div>
          <div className="font-medium text-sm text-neutral-200 leading-tight">
            {cat?.type ?? '—'}
          </div>
          <div className="text-xs text-neutral-400 leading-snug">
            {drugName && <div>{drugName}</div>}
            {cat?.date && (
              <div className="font-mono text-cyan-300">
                {cat.date}
                {daysOut != null && (
                  <span className="text-neutral-500"> · {daysOut > 0 ? `${daysOut}d out` : `${Math.abs(daysOut)}d ago`}</span>
                )}
              </div>
            )}
            {cat?.indication && <div className="text-[10px] mt-0.5 text-neutral-500">{cat.indication}</div>}
          </div>
          {/* Materiality bar + rationale */}
          {cat?.materiality?.rationale && (
            <div className="pt-1 mt-1 border-t border-border/40 space-y-1">
              <div className="h-1 rounded-full bg-neutral-800/60 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    cat.materiality.score >= 0.7 ? 'bg-violet-400' :
                    cat.materiality.score >= 0.4 ? 'bg-amber-400' :
                    'bg-neutral-500'
                  }`}
                  style={{ width: `${cat.materiality.score * 100}%` }}
                />
              </div>
              <div className="text-[9px] text-neutral-500 leading-snug">
                {cat.materiality.rationale}
              </div>
            </div>
          )}
        </div>

        {/* 2. Fundamental value */}
        <div className="rounded-md border border-border bg-bg-card p-3 space-y-1">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            <ShieldCheck className="h-3 w-3" />
            Fair value (rNPV)
          </div>
          {perShareFair != null ? (
            <>
              <div className="font-mono text-sm text-neutral-100">
                {fmtUsd(perShareFair)} <span className="text-[10px] text-neutral-500">per share</span>
              </div>
              <div className="text-xs leading-snug">
                {upsideToFair != null && (
                  <span className={upsideToFair >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                    {fmtPct(upsideToFair)} vs ${currentPrice?.toFixed(2)}
                  </span>
                )}
                {ev?.projected_dilution_pct && ev.projected_dilution_pct > 0 && (
                  <div className="text-[10px] text-amber-300/70 mt-0.5">
                    after −{ev.projected_dilution_pct.toFixed(0)}% dilution
                  </div>
                )}
              </div>
            </>
          ) : equityPostM != null ? (
            <>
              <div className="font-mono text-sm text-neutral-100">{fmtUSD(equityPostM)}</div>
              <div className="text-[10px] text-neutral-500">total equity (no per-share)</div>
            </>
          ) : rnpv?.rnpv_m != null ? (
            <>
              <div className="font-mono text-sm text-neutral-100">{fmtUSD(rnpv.rnpv_m * 1e6)}</div>
              <div className="text-[10px] text-neutral-500">rNPV (asset only)</div>
            </>
          ) : (
            <div className="text-xs text-neutral-500">computing…</div>
          )}
        </div>

        {/* 3. Trading setup */}
        <div className="rounded-md border border-border bg-bg-card p-3 space-y-1">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            <TrendingUp className="h-3 w-3" />
            Trading setup
          </div>
          {optionsImplied != null ? (
            <>
              <div className="font-mono text-sm text-cyan-300">
                ±{optionsImplied.toFixed(1)}%
              </div>
              <div className="text-[10px] text-neutral-500">market-implied move</div>
            </>
          ) : (
            <div className="font-mono text-sm text-neutral-500">no options data</div>
          )}
          {(scenarioUp != null || scenarioDown != null) && (
            <div className="flex gap-2 text-xs">
              {scenarioUp != null && <span className="text-emerald-300 font-mono">{fmtPct(scenarioUp)}</span>}
              {scenarioDown != null && <span className="text-red-300 font-mono">{fmtPct(scenarioDown)}</span>}
              <span className="text-[10px] text-neutral-500 self-end">scenarios</span>
            </div>
          )}
          {/* Setup quality verdict — answers user's NTLA pushback in
              one glance. Full breakdown is in SetupQualityPanel below. */}
          {stock.setup_quality?.score != null && (
            <div className="pt-1 mt-1 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-mono ${
                  stock.setup_quality.flag === 'red' ? 'text-red-300' :
                  stock.setup_quality.flag === 'green' ? 'text-emerald-300' :
                  'text-amber-300'
                }`}>
                  Setup {(stock.setup_quality.score * 100).toFixed(0)}/100
                </span>
                <span className="text-[10px] text-neutral-500 truncate" title={stock.setup_quality.verdict}>
                  {stock.setup_quality.verdict.replace(' — ', ' · ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Top risk */}
        <div className="rounded-md border border-border bg-bg-card p-3 space-y-1">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            <AlertTriangle className="h-3 w-3" />
            Biggest risk
          </div>
          {topRisk ? (
            <>
              <div className={`text-xs font-medium leading-tight ${
                topRisk.severity === 'high' ? 'text-red-300' :
                  topRisk.severity === 'med' ? 'text-amber-300' :
                    'text-neutral-300'
              }`}>
                {topRisk.label}
              </div>
              <div className="text-[10px] text-neutral-500 leading-snug">{topRisk.detail}</div>
              {risks.length > 1 && (
                <div className="text-[10px] text-neutral-600 mt-0.5">
                  + {risks.length - 1} more risk{risks.length > 2 ? 's' : ''}
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-emerald-300/80">No critical risks flagged</div>
          )}
        </div>
      </div>

      {/* Verdict bar */}
      <div className={`rounded-md border ${verdictTone.border} ${verdictTone.bg} p-3`}>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-0.5 min-w-[88px]">
            <div className={`text-xs uppercase tracking-wider font-bold ${verdictTone.text}`}>
              {verdictTone.label}
            </div>
            {conf != null && (
              <div className="text-[10px] text-neutral-500">
                conf {(conf * 100).toFixed(0)}%
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <div className="text-xs text-neutral-300 leading-snug">
              {verdictReasons.length > 0
                ? verdictReasons.join(' · ')
                : 'Insufficient data for strong verdict.'}
            </div>
            {audit?.overrides_applied && audit.overrides_applied.length > 0 && (
              <div className="text-[10px] text-emerald-300/70 inline-flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5" />
                {audit.overrides_applied.length} verified-source override{audit.overrides_applied.length > 1 ? 's' : ''}
                {' '}
                <span className="text-neutral-600">(authoritative data beats LLM inference)</span>
              </div>
            )}
            {(!audit?.overrides_applied || audit.overrides_applied.length === 0) && (
              <div className="text-[10px] text-amber-300/70 inline-flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                Pre-approval drug — primarily LLM-derived assumptions
                <span className="text-neutral-600">(no FDA approval/Orange Book data yet)</span>
              </div>
            )}
          </div>
          <a href="#rnpv-detail" className="text-[10px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-0.5 self-end">
            Evidence <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
