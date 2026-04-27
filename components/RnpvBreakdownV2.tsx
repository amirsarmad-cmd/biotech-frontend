'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { TrendingUp, RefreshCw, Calendar, DollarSign, Users, Building2, AlertTriangle, Info } from 'lucide-react';
import { analyzeNpv, type NPVAnalyzeResponse, type DrugEconomicsV2 } from '@/lib/api';
import { InfoTooltip } from './tooltips';
import { VerifiedFactsPanel } from './VerifiedFactsPanel';
import { MoveEstimatesPanel } from './MoveEstimatesPanel';
import { EquityValuePanel } from './EquityValuePanel';
import { DilutionCapacityPanel } from './DilutionCapacityPanel';
import { SourcePrecedenceAuditPanel } from './SourcePrecedenceAuditPanel';

interface Props {
  ticker: string;
  marketCapM: number;
  npvCatalyst?: {
    type: string;
    date: string;
    probability: number;
    description: string;
    drug_name?: string;
    indication?: string;
    phase?: string;
  } | null;
}

const fmtM = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}T`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}B`;
  return `${n.toFixed(0)}M`;
};

const fmtNum = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
};

const fmtPct = (n: number | null | undefined, decimals = 1): string => {
  if (n == null || isNaN(n)) return '—';
  return `${n.toFixed(decimals)}%`;
};

const fmtUSD = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const SCOPE_LABEL: Record<string, string> = {
  first_approval: 'First approval',
  new_indication: 'New indication',
  label_expansion: 'Label expansion',
  phase_readout: 'Phase readout',
  earnings: 'Earnings',
  other: 'Other',
};

const MODALITY_LABEL: Record<string, string> = {
  small_molecule: 'Small molecule',
  biologic: 'Biologic',
  antibody: 'Antibody',
  cell_gene: 'Cell / gene therapy',
  rna: 'RNA therapy',
  other: 'Other',
};

export function RnpvBreakdownV2({ ticker, marketCapM, npvCatalyst }: Props) {
  const [forceRefresh, setForceRefresh] = useState(false);
  const [discountRate, setDiscountRate] = useState(0.10);
  const [dilutionPct, setDilutionPct] = useState(0);  // 0-50%, addresses methodology audit #2

  const q = useQuery({
    queryKey: ['analyze-npv-v2', ticker, npvCatalyst?.type, npvCatalyst?.date, npvCatalyst?.drug_name, discountRate, dilutionPct, forceRefresh],
    queryFn: async (): Promise<NPVAnalyzeResponse> => {
      const resp = await analyzeNpv({
        ticker,
        catalyst_type: npvCatalyst?.type || 'FDA Decision',
        market_cap_m: marketCapM,
        // The catalyst's `probability` field is P(approval / favorable outcome).
        // Send it as p_approval — NOT p_commercial. p_commercial (P(strong uptake | approved))
        // is a separate haircut handled by the V2 LLM economics estimate.
        p_approval: npvCatalyst?.probability,
        discount_rate: discountRate,
        force_refresh: forceRefresh,
        // Scope LLM to THIS specific catalyst (drug + indication) so it
        // doesn't return a whole-company estimate. This is critical for
        // companies with multiple programs (e.g., NTLA has lonvo-z + nex-z).
        drug_name_override: npvCatalyst?.drug_name,
        description_override: npvCatalyst?.description,
        // Methodology audit #2 — capital structure
        dilution_assumed_pct: dilutionPct > 0 ? dilutionPct : undefined,
      });
      // Reset force flag after consuming so subsequent prop changes use cache
      if (forceRefresh) setForceRefresh(false);
      return resp;
    },
    staleTime: 60 * 60_000, // 1 hour client-side
    enabled: !!ticker && !!marketCapM && marketCapM > 0,
  });

  if (q.isLoading) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <div className="mb-3 flex items-center gap-2">
          <h2>rNPV Analysis (V2)</h2>
          <span className="text-xs text-violet-300">structured economics + DCF</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Pulling FDA / ClinicalTrials.gov / Orange Book / SEC EDGAR data and computing structured rNPV…
        </div>
        <div className="mt-2 text-xs text-neutral-600">First call per drug ~30-50s (parses official-source filings + LLM economics); subsequent calls cached for 1 day.</div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
        <h2 className="mb-1 text-red-300">rNPV Analysis unavailable</h2>
        <p className="text-sm text-red-400/80">{(q.error as Error).message}</p>
      </div>
    );
  }

  const data = q.data;
  const e2 = data?.economics_v2;
  const r = data?.rnpv;

  if (!e2 || !r || r.error) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-6">
        <h2 className="mb-1 text-amber-200">rNPV Analysis</h2>
        <p className="text-sm text-amber-400/80">
          {r?.error || e2?.error || 'No structured economics available for this catalyst.'}
        </p>
      </div>
    );
  }

  // Derive comparison: legacy NPV vs rNPV
  const legacyNpvB = data?.npv?.drug_npv_m ? data.npv.drug_npv_m / 1000 : null;
  const rnpvB = r.rnpv_m / 1000;
  const detNpvB = r.deterministic_npv_m / 1000;

  const scopeLabel = SCOPE_LABEL[e2.catalyst_scope || 'other'] || e2.catalyst_scope || '—';
  const modalityLabel = MODALITY_LABEL[e2.modality || 'other'] || e2.modality || '—';

  // Forecast chart data — convert to plot-friendly
  const chartData = (r.revenue_forecast || []).map((row) => ({
    year: row.year,
    revenue: row.revenue_m,
    pv: row.pv_m,
  }));
  const loeYear = (r.assumptions_used?.loe_year as number | undefined);
  const launchYear = (r.assumptions_used?.launch_year as number | undefined);

  return (
    <div className="rounded-lg border border-border bg-panel p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2>rNPV Analysis <span className="ml-1 text-xs font-normal text-violet-300">V2 · structured DCF</span></h2>
            <InfoTooltip
              text="True risk-adjusted NPV: year-by-year discounted cash flow with S-curve penetration ramp, COGS/tax, LOE drop-off. rNPV = deterministic NPV × P(approval) × P(commercial)."
              position="bottom"
            />
          </div>
          {npvCatalyst && (
            <div className="mt-1 text-xs text-neutral-500">
              <span className="text-violet-300">{scopeLabel}</span>
              {' · '}<span className="text-emerald-400">{npvCatalyst.type}</span>
              {' · '}{npvCatalyst.date}
              {' · '}p_approval={((npvCatalyst.probability || 0) * 100).toFixed(0)}%
              {data?.from_cache && <span className="ml-2 text-violet-400">· cached</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={discountRate}
            onChange={(e) => setDiscountRate(Number(e.target.value))}
            className="rounded border border-border bg-bg/50 px-2 py-1 text-xs text-neutral-300"
          >
            <option value={0.08}>WACC 8%</option>
            <option value={0.10}>WACC 10%</option>
            <option value={0.12}>WACC 12%</option>
            <option value={0.15}>WACC 15%</option>
          </select>
          <select
            value={dilutionPct}
            onChange={(e) => setDilutionPct(Number(e.target.value))}
            className="rounded border border-border bg-bg/50 px-2 py-1 text-xs text-neutral-300"
            title="Assumed dilution to fund commercialization. Set 0% for no-dilution per-share NPV."
          >
            <option value={0}>0% dilution</option>
            <option value={15}>15% dilution</option>
            <option value={30}>30% dilution</option>
            <option value={50}>50% dilution</option>
          </select>
          <button
            onClick={() => setForceRefresh(true)}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-neutral-400 hover:bg-bg/50"
            title="Re-fetch with fresh LLM call (bypass cache)"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Top-level numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Risk-adj NPV" value={`$${rnpvB.toFixed(2)}B`} sub={`${fmtPct(r.fundamental_impact_pct)} of cap`} accent="violet" />
        <Stat label="Deterministic NPV" value={`$${detNpvB.toFixed(2)}B`} sub="if approved & commercial" />
        <Stat label="Peak sales" value={`$${(r.peak_sales_usd_b || 0).toFixed(2)}B`} sub={e2.peak_sales_year ? `in ${e2.peak_sales_year}` : ''} />
        <Stat
          label="Legacy NPV"
          value={legacyNpvB != null ? `$${legacyNpvB.toFixed(2)}B` : '—'}
          sub={legacyNpvB != null && rnpvB > 0 ? `${(legacyNpvB / rnpvB * 100).toFixed(0)}% of rNPV` : ''}
          accent="muted"
        />
      </div>

      {/* Layer 1 (verified facts) — sits above LLM-driven analysis to anchor user expectations */}
      <VerifiedFactsPanel
        verifiedFacts={(e2 as unknown as { verified_facts?: typeof e2.verified_facts }).verified_facts ?? null}
        confidenceScore={e2.confidence_score ?? null}
      />

      {/* Source-precedence audit — what verified values overrode LLM inference */}
      <SourcePrecedenceAuditPanel audit={data?.source_precedence_audit ?? null} />

      {/* Move estimates — 4 distinct types per ChatGPT critique */}
      <MoveEstimatesPanel moveEstimates={data?.move_estimates ?? null} />

      {/* Capital-structure adjusted equity value (SEC EDGAR balance sheet) */}
      <EquityValuePanel
        equityValue={data?.equity_value ?? null}
        capitalStructure={data?.capital_structure ?? null}
        currentMarketCapM={marketCapM}
      />

      {/* Dilution capacity from SEC narrative (ATM, shelf, warrants) */}
      <DilutionCapacityPanel dilutionCapacity={data?.dilution_capacity ?? null} />

      {/* Probability resolution badge — shows what value drove the rNPV */}
      {data?.probability_resolution && (
        <div className="rounded-md border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-violet-100/80">
          <span className="font-medium">P(approval) used:</span>{' '}
          <span className="font-mono text-violet-200">
            {(data.probability_resolution.p_approval_used * 100).toFixed(0)}%
          </span>{' '}
          <span className="text-neutral-500">
            (source: {data.probability_resolution.p_approval_source.replace(/_/g, ' ')})
          </span>
          {data.probability_resolution.rnpv_method && (
            <span className="ml-3 text-neutral-500">
              · rNPV method: {data.probability_resolution.rnpv_method}
            </span>
          )}
        </div>
      )}

      {/* ─── METHODOLOGY AUDIT: Scenarios + Per-share + Split prob ─── */}
      {(r.scenarios || r.per_share_drug_npv_usd || e2.p_event_occurs != null) && (
        <div className="rounded-md border border-violet-500/20 bg-violet-500/5 p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-200">
            <Info className="h-3.5 w-3.5" />
            Scenario range &amp; per-share — methodology audit fields
            <InfoTooltip
              text="Bear/base/bull scale with LLM penetration min/mid/max. Per-share NPV uses yfinance shares outstanding. Split probability separates timing-certainty from outcome-success — addresses long-known weaknesses in single-prob biotech models."
              position="bottom"
            />
          </div>

          {/* Bear / Base / Bull scenarios */}
          {r.scenarios && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['bear', 'base', 'bull'] as const).map((k) => {
                const s = r.scenarios?.[k];
                if (!s) return null;
                const tone = k === 'base' ? 'border-violet-500/30 bg-violet-500/10' : 'border-border bg-bg/40';
                const label = k === 'bear' ? 'Bear' : k === 'base' ? 'Base' : 'Bull';
                const accent = k === 'bear' ? 'text-amber-300' : k === 'base' ? 'text-violet-200' : 'text-emerald-300';
                return (
                  <div key={k} className={`rounded-md border p-3 ${tone}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${accent}`}>{label}</span>
                      <span className="text-[10px] text-neutral-500">{s.penetration_pct}% pen</span>
                    </div>
                    <div className="mt-1 text-lg font-semibold">${(s.rnpv_m / 1000).toFixed(2)}B</div>
                    <div className="text-[11px] text-neutral-500">peak ${s.peak_sales_usd_b.toFixed(2)}B</div>
                    <div className="mt-1 text-[10px] leading-tight text-neutral-500">{s.label}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Per-share NPV row */}
          {r.shares_outstanding_m && r.per_share_drug_npv_usd != null && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md bg-bg/40 p-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-neutral-500">Shares outstanding</div>
                <div className="font-mono text-sm">{r.shares_outstanding_m.toFixed(1)}M</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-neutral-500">Per-share rNPV</div>
                <div className="font-mono text-sm text-violet-200">${r.per_share_drug_npv_usd.toFixed(2)}</div>
              </div>
              {r.per_share_after_dilution_usd != null && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-neutral-500">After {r.dilution_assumed_pct}% dilution</div>
                  <div className="font-mono text-sm text-amber-300">${r.per_share_after_dilution_usd.toFixed(2)}</div>
                </div>
              )}
            </div>
          )}

          {/* Split probability */}
          {e2.p_event_occurs != null && e2.p_positive_outcome != null && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md bg-bg/40 p-3">
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  P(event occurs)
                  <InfoTooltip text="Timing certainty — probability the catalyst event itself happens on the stated date (readout reported, PDUFA decision rendered). NOT the probability of success." position="bottom" />
                </div>
                <div className="font-mono text-sm">{(e2.p_event_occurs * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  P(positive outcome)
                  <InfoTooltip text="Probability the outcome is favorable, given the event happens. This is what investors mean by 'probability of approval'." position="bottom" />
                </div>
                <div className="font-mono text-sm">{(e2.p_positive_outcome * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  P(commercial success)
                  <InfoTooltip text="Probability of strong commercial uptake given approval. First-in-class with unmet need: 0.75-0.90; me-too in crowded indication: 0.30-0.55." position="bottom" />
                </div>
                <div className="font-mono text-sm">{((e2.commercial_success_prob ?? 0.6) * 100).toFixed(0)}%</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Caveats — be honest about LLM-data limits */}
      {r.caveats && r.caveats.length > 0 && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Limits of this analysis
          </div>
          <ul className="space-y-1 text-xs text-amber-100/80">
            {r.caveats.map((c, i) => (
              <li key={i} className="flex gap-2"><span className="text-amber-500">•</span><span>{c}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Structured economics */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-200">
          <Building2 className="h-3.5 w-3.5" />
          Structured drug economics — {scopeLabel}{e2.indication ? `: ${e2.indication}` : ''}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            icon={<Users className="h-3.5 w-3.5" />}
            label="Addressable population"
            value={`${fmtNum(e2.addressable_population_us)} US · ${fmtNum(e2.addressable_population_global)} global`}
          />
          <Field
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Annual pricing"
            value={`${fmtUSD(e2.annual_cost_min_usd)} – ${fmtUSD(e2.annual_cost_max_usd)}`}
            sub={e2.standard_of_care_cost_usd ? `vs SOC ${fmtUSD(e2.standard_of_care_cost_usd)}` : ''}
          />
          <Field
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Peak penetration"
            value={`${fmtPct(e2.penetration_mid_pct)} mid`}
            sub={e2.penetration_min_pct != null && e2.penetration_max_pct != null ? `${fmtPct(e2.penetration_min_pct)} – ${fmtPct(e2.penetration_max_pct)}` : ''}
          />
          <Field label="Modality" value={modalityLabel} sub={e2.first_in_class ? 'first-in-class' : ''} />
          <Field
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Launch → peak → LOE"
            value={`${e2.launch_year || '—'} → ${e2.peak_sales_year || '—'} → ${(e2.patent_expiry_date || '').slice(0, 4) || '—'}`}
            sub={e2.time_to_peak_years ? `${e2.time_to_peak_years}y to peak` : ''}
          />
          <Field
            label="P(commercial | approval)"
            value={fmtPct((e2.commercial_success_prob || 0) * 100, 0)}
            sub={`competitive: ${e2.competitive_intensity || '—'}`}
          />
        </div>
      </div>

      {/* Revenue forecast chart */}
      {chartData.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-200">
            <TrendingUp className="h-3.5 w-3.5" />
            Year-by-year revenue forecast (deterministic, in $M)
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.30} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" stroke="#525252" fontSize={11} tickMargin={6} />
                <YAxis stroke="#525252" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}B`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', fontSize: 12 }}
                  formatter={(value: number, name: string) => [`$${value.toFixed(0)}M`, name === 'revenue' ? 'Revenue' : 'PV']}
                  labelFormatter={(year) => `Year ${year}`}
                />
                <Area type="monotone" dataKey="revenue" stroke="#a78bfa" fill="url(#rev)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="pv" stroke="#34d399" fill="url(#pv)" strokeWidth={1.5} />
                {launchYear && <ReferenceLine x={launchYear} stroke="#525252" strokeDasharray="3 3" label={{ value: 'launch', fill: '#737373', fontSize: 10 }} />}
                {loeYear && <ReferenceLine x={loeYear} stroke="#fb923c" strokeDasharray="3 3" label={{ value: 'LOE', fill: '#fb923c', fontSize: 10 }} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-neutral-500">
            <span><span className="inline-block h-2 w-2 rounded-sm bg-violet-400/60 mr-1" />Revenue (undiscounted)</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-emerald-400/60 mr-1" />Present value</span>
            <span>· LOE drop-off: {fmtPct((e2.loe_dropoff_pct || 0) * 100, 0)}</span>
            <span>· COGS: {fmtPct((e2.cogs_pct_estimate || 0) * 100, 0)}</span>
            <span>· Discount rate: {fmtPct(discountRate * 100, 0)}</span>
          </div>
        </div>
      )}

      {/* Competitors + risks */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {e2.competitors && e2.competitors.length > 0 && (
          <div className="rounded-md border border-border bg-bg/50 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Competitors</div>
            <ul className="mt-1 text-sm text-neutral-300 space-y-0.5">
              {e2.competitors.slice(0, 5).map((c, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-neutral-600">·</span>{c}
                </li>
              ))}
            </ul>
          </div>
        )}
        {e2.key_risks && e2.key_risks.length > 0 && (
          <div className="rounded-md border border-border bg-bg/50 p-3">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-neutral-500">
              <AlertTriangle className="h-3 w-3" /> Catalyst-specific risks
            </div>
            <ul className="mt-1 text-sm text-neutral-300 space-y-0.5">
              {e2.key_risks.slice(0, 4).map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-neutral-600">·</span>{r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Rationale */}
      {e2.llm_rationale && (
        <div className="rounded-md border border-border bg-bg/50 p-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500">
                <span>LLM rationale</span>
                {e2.llm_provider && <span className="text-neutral-600">via {e2.llm_provider}</span>}
              </div>
              <p className="mt-1 text-sm text-neutral-300 leading-relaxed">{e2.llm_rationale}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'violet' | 'muted';
}) {
  const valueColor = accent === 'violet' ? 'text-violet-200'
    : accent === 'muted' ? 'text-neutral-400'
    : 'text-neutral-100';
  return (
    <div className="rounded-md border border-border bg-bg/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${valueColor}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  sub,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-bg/40 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-neutral-200">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}
