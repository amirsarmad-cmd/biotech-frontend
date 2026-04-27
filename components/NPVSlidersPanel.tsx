'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sliders as SlidersIcon, RotateCcw, TrendingUp, ShieldCheck, Sparkles } from 'lucide-react';
import { InfoTooltip } from './tooltips';
import {
  analyzeNpv,
  type NPVAnalyzeResponse,
  type ProvenanceEntry,
  type ProvenanceSource,
  type Catalyst,
} from '@/lib/api';

interface Props {
  ticker: string;
  marketCapM?: number | null;
  /** Catalyst from /stocks/{ticker} — used for analyzeNpv params and context */
  npvCatalyst?: Catalyst | null;
  /** Fallback initial values (from screener) if rNPV V2 hasn't loaded yet */
  fallbackInitial?: {
    peakSalesB?: number | null;
    pApproval?: number | null;
    pCommercial?: number | null;
    marketCapM?: number | null;
  };
}

interface Sliders {
  pApproval: number;
  pCommercial: number;
  patientPopK: number;
  annualCostUsd: number;
  penetrationPct: number;
  timeToPeakYears: number;
  discountRate: number;
  taxRate: number;
  cogsPct: number;
}

const DEFAULTS: Sliders = {
  pApproval: 0.7,
  pCommercial: 0.6,
  patientPopK: 100,
  annualCostUsd: 50_000,
  penetrationPct: 15,
  timeToPeakYears: 5,
  discountRate: 12,
  taxRate: 21,
  cogsPct: 15,
};

const SOURCE_LABEL: Record<ProvenanceSource, string> = {
  openfda: 'OpenFDA',
  clinicaltrials_gov: 'ClinicalTrials.gov',
  sec_edgar: 'SEC EDGAR',
  orange_book: 'Orange Book',
  polygon_options: 'Polygon options',
  finnhub: 'Finnhub',
  llm_grounded_web: 'LLM (web-grounded)',
  llm_inference: 'AI estimate',
  user_research: 'User research',
};

const SOURCE_TONE: Record<ProvenanceSource, string> = {
  openfda: 'text-emerald-300',
  clinicaltrials_gov: 'text-emerald-300',
  sec_edgar: 'text-emerald-300',
  orange_book: 'text-emerald-300',
  polygon_options: 'text-cyan-300',
  finnhub: 'text-cyan-300',
  llm_grounded_web: 'text-violet-300',
  llm_inference: 'text-amber-300',
  user_research: 'text-violet-300',
};

const CONFIDENCE_TONE: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export function NPVSlidersPanel({ ticker, marketCapM, npvCatalyst, fallbackInitial }: Props) {
  // Fetch the same analyzeNpv response RnpvBreakdownV2 uses so we get
  // economicsV2 with provenance. Same queryKey ⇒ deduped by React Query.
  const npvQ = useQuery({
    queryKey: [
      'analyze-npv-v2',
      ticker,
      npvCatalyst?.type,
      npvCatalyst?.date,
      npvCatalyst?.drug_name,
      undefined, // discountRate — kept undefined here so RnpvBreakdownV2's default key matches
      undefined, // dilutionPct
      false,     // forceRefresh
    ],
    queryFn: async (): Promise<NPVAnalyzeResponse> => {
      return analyzeNpv({
        ticker,
        catalyst_type: npvCatalyst?.type || 'FDA Decision',
        market_cap_m: marketCapM ?? undefined,
        p_approval: npvCatalyst?.probability,
        drug_name_override: npvCatalyst?.drug_name,
        description_override: npvCatalyst?.description,
      });
    },
    staleTime: 60 * 60_000,
    enabled: !!ticker && !!marketCapM && marketCapM > 0,
  });

  const e2 = npvQ.data?.economics_v2 ?? null;
  const prov: Record<string, ProvenanceEntry> = (e2?.provenance ?? {}) as Record<string, ProvenanceEntry>;
  const drugName = npvCatalyst?.drug_name ?? null;
  const indication = npvCatalyst?.indication ?? null;
  const catalystType = npvCatalyst?.type ?? null;

  // Compute the "AI defaults" from the rich V2 economics (if available)
  // or fall back to screener-level NPV
  const aiDefaults: Sliders = useMemo(() => {
    // Prefer V2 fields when available
    const popUS = e2?.addressable_population_us;
    const patientPopK = popUS != null ? popUS / 1000 : DEFAULTS.patientPopK;

    const usCost = e2?.annual_cost_us_net_usd;
    const minCost = e2?.annual_cost_min_usd;
    const annualCostUsd = usCost ?? minCost ?? DEFAULTS.annualCostUsd;

    const penMid = e2?.penetration_mid_pct;
    const penetrationPct = penMid ?? DEFAULTS.penetrationPct;

    const ttp = e2?.time_to_peak_years;
    const timeToPeakYears = ttp ?? DEFAULTS.timeToPeakYears;

    // P(approval) — prefer split-prob from V2, fall back to screener
    const pPos = e2?.p_positive_outcome;
    const pApproval = pPos ?? fallbackInitial?.pApproval ?? DEFAULTS.pApproval;

    const pCom = e2?.commercial_success_prob;
    const pCommercial = pCom ?? fallbackInitial?.pCommercial ?? DEFAULTS.pCommercial;

    // COGS from V2
    const cogsPct = e2?.cogs_pct_estimate != null ? e2.cogs_pct_estimate * 100 : DEFAULTS.cogsPct;

    return {
      patientPopK,
      annualCostUsd,
      penetrationPct,
      timeToPeakYears,
      pApproval,
      pCommercial,
      discountRate: DEFAULTS.discountRate,
      taxRate: DEFAULTS.taxRate,
      cogsPct,
    };
  }, [e2, fallbackInitial]);

  const [sliders, setSliders] = useState<Sliders>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`npv-sliders:${ticker}:${drugName || 'default'}`);
        if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
      } catch { /* ignore */ }
    }
    return aiDefaults;
  });

  // When AI defaults arrive after first render (from async query), and the
  // user hasn't touched anything yet, refresh to reflect the better data.
  // We track a "user has edited" flag so we don't blow away their changes.
  const [userEdited, setUserEdited] = useState(false);
  useEffect(() => {
    if (!userEdited && e2) setSliders(aiDefaults);
  }, [aiDefaults, userEdited, e2]);

  // Persist on change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!userEdited) return;
    try {
      window.localStorage.setItem(`npv-sliders:${ticker}:${drugName || 'default'}`, JSON.stringify(sliders));
    } catch { /* ignore */ }
  }, [ticker, drugName, sliders, userEdited]);

  const set = (patch: Partial<Sliders>) => {
    setUserEdited(true);
    setSliders(s => ({ ...s, ...patch }));
  };
  const reset = () => {
    setUserEdited(false);
    setSliders(aiDefaults);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(`npv-sliders:${ticker}:${drugName || 'default'}`);
      } catch { /* ignore */ }
    }
  };

  // Build drug-specific context strings explaining what each AI default means
  const fieldContext = useMemo(() => {
    const ctx: Record<string, string> = {};
    if (!e2) return ctx;

    const popUS = e2.addressable_population_us ?? null;
    const popGlobal = e2.addressable_population_global ?? null;
    if (popUS != null) {
      ctx.patientPop = `AI estimate: ~${(popUS / 1000).toFixed(0)}K US patients` +
        (popGlobal ? ` (${(popGlobal / 1000).toFixed(0)}K global)` : '') +
        (indication ? ` with ${indication.slice(0, 60)}.` : '.');
    }

    const usCost = e2.annual_cost_us_net_usd ?? null;
    const exUsCost = e2.annual_cost_exus_net_usd ?? null;
    const minCost = e2.annual_cost_min_usd ?? null;
    const maxCost = e2.annual_cost_max_usd ?? null;
    if (usCost != null) {
      const parts = [`AI estimate: $${(usCost / 1000).toFixed(0)}K US net price/yr`];
      if (exUsCost != null) parts.push(`$${(exUsCost / 1000).toFixed(0)}K ex-US net`);
      if (minCost != null && maxCost != null) parts.push(`(gross range $${(minCost / 1000).toFixed(0)}K-$${(maxCost / 1000).toFixed(0)}K)`);
      ctx.annualCost = parts.join(' · ') + '.';
    } else if (minCost != null && maxCost != null) {
      ctx.annualCost = `AI estimate: $${(minCost / 1000).toFixed(0)}K-$${(maxCost / 1000).toFixed(0)}K gross/yr.`;
    }

    const penMin = e2.penetration_min_pct ?? null;
    const penMid = e2.penetration_mid_pct ?? null;
    const penMax = e2.penetration_max_pct ?? null;
    if (penMid != null) {
      const range = (penMin != null && penMax != null) ? ` (range ${penMin.toFixed(0)}-${penMax.toFixed(0)}%)` : '';
      ctx.penetration = `AI estimate: ${penMid.toFixed(0)}% of treatable population at peak${range}` +
        (e2.competitive_intensity ? ` · competitive intensity: ${e2.competitive_intensity}.` : '.');
    }

    const pPos = e2.p_positive_outcome ?? null;
    if (pPos != null) {
      ctx.pApproval = `AI estimate: ${(pPos * 100).toFixed(0)}% probability of positive outcome` +
        (catalystType ? ` for ${catalystType}` : '') +
        (e2.first_in_class ? ' (first-in-class — adjusted down for novelty risk).' : '.');
    }

    const pCom = e2.commercial_success_prob ?? null;
    if (pCom != null) {
      ctx.pCommercial = `AI estimate: ${(pCom * 100).toFixed(0)}% probability of commercial success` +
        (e2.first_in_class ? ' (first-in-class typically commands premium pricing).' :
          (e2.competitive_intensity === 'high' ? ' (high competition pulls this down).' :
            e2.competitive_intensity === 'low' ? ' (low competition supports higher uptake).' : '.'));
    }

    if (e2.time_to_peak_years != null) {
      ctx.timeToPeak = `AI estimate: ${e2.time_to_peak_years} years from launch to peak sales` +
        (e2.modality ? ` (${e2.modality} typical: ` +
          (e2.modality === 'biologic' ? '4-6 yrs' :
            e2.modality === 'small_molecule' ? '3-5 yrs' :
              e2.modality === 'cell_gene' ? '5-7 yrs' :
                '4-6 yrs') + ').' : '.');
    }

    ctx.discount = `Default: 12% biotech WACC. Higher (15-20%) for early-stage / micro-cap risk; lower (8-10%) for de-risked late-stage assets.`;

    return ctx;
  }, [e2, indication, catalystType]);

  // Live NPV calculation in browser
  const calc = useMemo(() => {
    const bottomUpPeakB = (sliders.patientPopK * 1000 * (sliders.penetrationPct / 100) * sliders.annualCostUsd) / 1e9;
    const peakSalesB = bottomUpPeakB;
    const riskAdjustedPeakB = peakSalesB * sliders.pApproval * sliders.pCommercial;
    const annualGrossProfitB = riskAdjustedPeakB * (1 - sliders.cogsPct / 100);
    const annualAfterTaxB = annualGrossProfitB * (1 - sliders.taxRate / 100);
    const exclusivityYears = 10;
    let totalDiscountedB = 0;
    const discountFactor = sliders.discountRate / 100;
    const ttp = sliders.timeToPeakYears;
    for (let year = 1; year <= exclusivityYears; year++) {
      const ramp = Math.min(year / ttp, 1.0);
      const yearAfterTax = annualAfterTaxB * ramp;
      const discounted = yearAfterTax / Math.pow(1 + discountFactor, year);
      totalDiscountedB += discounted;
    }
    const npvB = totalDiscountedB;
    const marketCapB = (marketCapM ?? 0) / 1000;
    const npvMultiple = marketCapB > 0 ? npvB / marketCapB : 0;
    return { peakSalesB, riskAdjustedPeakB, annualAfterTaxB, npvB, npvMultiple };
  }, [sliders, marketCapM]);

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base">
          <SlidersIcon className="h-4 w-4 text-cyan-400" />
          NPV Calculator
          <InfoTooltip
            text="Live NPV calculation. Each slider has an AI-derived default based on actual data sources (FDA, ClinicalTrials.gov, SEC, Orange Book) plus LLM analysis where authoritative data isn't available. Each slider's (i) icon explains what it means; the line below the slider shows where the AI default came from. When you move a slider, the slider turns amber and shows the AI's original value next to your value. Saved per-drug to your browser."
            position="bottom"
          />
          {drugName && <span className="ml-1 text-xs text-neutral-400">· {drugName}</span>}
        </h3>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-amber-300 transition"
        >
          <RotateCcw className="h-3 w-3" /> Reset to AI defaults
        </button>
      </div>

      {npvQ.isLoading && !e2 && (
        <div className="mb-4 rounded-md border border-border/30 bg-bg/30 px-3 py-2 text-xs text-neutral-500">
          Loading AI defaults from FDA / ClinicalTrials / Orange Book / SEC sources…
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Drug economics */}
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Drug economics</div>

          <ProvSlider
            label="Patient population (US)"
            value={sliders.patientPopK}
            aiDefault={aiDefaults.patientPopK}
            min={1} max={5000} step={5}
            help="The estimated number of patients in the US who could be treated by this drug. Drives peak sales: peak revenue = patients × penetration × annual cost. Rare disease drugs target small populations (<50K); common conditions target millions."
            onChange={v => set({ patientPopK: v })}
            display={(v) => v < 1000 ? `${v.toFixed(0)}K` : `${(v / 1000).toFixed(1)}M`}
            displayDelta={(v, ai) => {
              const f = (n: number) => n < 1000 ? `${n.toFixed(0)}K` : `${(n / 1000).toFixed(1)}M`;
              return `${f(v)} (AI: ${f(ai)})`;
            }}
            provenance={prov.addressable_population_us}
            context={fieldContext.patientPop}
          />

          <ProvSlider
            label="Penetration (%)"
            value={sliders.penetrationPct}
            aiDefault={aiDefaults.penetrationPct}
            min={1} max={80} step={1} unit="%"
            help="What share of the treatable population this drug captures at peak. Best-in-class rare disease drugs hit 30-50%; competitive markets see 10-20%; me-too drugs in crowded categories often <10%."
            onChange={v => set({ penetrationPct: v })}
            displayDelta={(v, ai) => `${v}% (AI: ${ai.toFixed(0)}%)`}
            provenance={prov.penetration_mid_pct}
            context={fieldContext.penetration}
          />

          <ProvSlider
            label="Annual cost per patient"
            value={sliders.annualCostUsd}
            aiDefault={aiDefaults.annualCostUsd}
            min={1000} max={3_000_000} step={1000}
            help="Annual list price per patient. Rare disease orphan drugs: $200K-$500K (some up to $3M+ for one-time gene therapies). Mass market biologics: $30K-$100K. Specialty oral: $5K-$50K. Net price after rebates is typically 20-40% lower than gross."
            onChange={v => set({ annualCostUsd: v })}
            display={(v) => v >= 1_000_000 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
            displayDelta={(v, ai) => {
              const f = (n: number) => n >= 1_000_000 ? `$${(n / 1e6).toFixed(2)}M` : `$${(n / 1000).toFixed(0)}K`;
              return `${f(v)} (AI: ${f(ai)})`;
            }}
            provenance={prov.annual_cost_us_net_usd ?? prov.annual_cost_min_usd}
            context={fieldContext.annualCost}
          />
        </div>

        {/* Risk & timing */}
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Risk &amp; timing</div>

          <ProvSlider
            label="P(approval)"
            value={sliders.pApproval * 100}
            aiDefault={aiDefaults.pApproval * 100}
            min={5} max={95} step={5} unit="%"
            help="Probability of regulatory approval (or positive readout for trial catalysts). Industry rates by stage: Phase 1→Approval ~10%, Phase 2→Approval ~20-30%, Phase 3→Approval ~50-65%, NDA/BLA filed→Approval ~85-90%. First-in-class novel mechanisms see 30-50% even at Phase 3."
            onChange={v => set({ pApproval: v / 100 })}
            displayDelta={(v, ai) => `${v}% (AI: ${ai.toFixed(0)}%)`}
            provenance={prov.p_positive_outcome ?? prov.commercial_success_prob}
            context={fieldContext.pApproval}
          />

          <ProvSlider
            label="P(commercial success | approval)"
            value={sliders.pCommercial * 100}
            aiDefault={aiDefaults.pCommercial * 100}
            min={20} max={100} step={5} unit="%"
            help="Probability the drug succeeds commercially CONDITIONAL on approval. Even approved drugs can fail commercially due to label restrictions, payer pushback, competition, or weaker-than-expected real-world data. Best-in-class: 80-90%. Me-too in crowded markets: 30-50%."
            onChange={v => set({ pCommercial: v / 100 })}
            displayDelta={(v, ai) => `${v}% (AI: ${ai.toFixed(0)}%)`}
            provenance={prov.commercial_success_prob}
            context={fieldContext.pCommercial}
          />

          <ProvSlider
            label="Time to peak sales (yrs)"
            value={sliders.timeToPeakYears}
            aiDefault={aiDefaults.timeToPeakYears}
            min={1} max={10} step={1} unit="y"
            help="Years from launch to peak annual sales. Specialty drugs with limited prescriber base ramp fast (3-5 years). Mass-market drugs needing wide adoption take longer (5-7). Cell/gene therapies with manufacturing constraints can take 7-10."
            onChange={v => set({ timeToPeakYears: v })}
            displayDelta={(v, ai) => `${v}y (AI: ${ai.toFixed(0)}y)`}
            provenance={prov.time_to_peak_years}
            context={fieldContext.timeToPeak}
          />

          <ProvSlider
            label="Discount rate"
            value={sliders.discountRate}
            aiDefault={aiDefaults.discountRate}
            min={5} max={25} step={0.5} unit="%"
            help="Weighted Average Cost of Capital (WACC) — the rate at which future cash flows are discounted to present value. Higher rate = lower NPV. Industry standard for biotech: 10-15%. Use 15-20% for high-risk small caps with going-concern questions; 8-10% for de-risked late-stage profitable companies."
            onChange={v => set({ discountRate: v })}
            displayDelta={(v, ai) => `${v}% (AI: ${ai.toFixed(1)}%)`}
            context={fieldContext.discount}
          />
        </div>
      </div>

      {/* Live results */}
      <div className="mt-5 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-cyan-200">
          <TrendingUp className="h-3.5 w-3.5" />
          Live NPV
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultStat
            label="Peak sales"
            value={`$${calc.peakSalesB.toFixed(2)}B`}
            help={`Peak annual sales = ${sliders.patientPopK < 1000 ? `${sliders.patientPopK.toFixed(0)}K` : `${(sliders.patientPopK / 1000).toFixed(1)}M`} patients × ${sliders.penetrationPct}% penetration × $${(sliders.annualCostUsd / 1000).toFixed(0)}K/yr cost = $${calc.peakSalesB.toFixed(2)}B/year at peak.`}
          />
          <ResultStat
            label="Risk-adj peak"
            value={`$${calc.riskAdjustedPeakB.toFixed(2)}B`}
            help={`Risk-adjusted peak = $${calc.peakSalesB.toFixed(2)}B × ${(sliders.pApproval * 100).toFixed(0)}% P(approval) × ${(sliders.pCommercial * 100).toFixed(0)}% P(commercial) = $${calc.riskAdjustedPeakB.toFixed(2)}B expected peak revenue.`}
          />
          <ResultStat
            label="Drug NPV"
            value={`$${calc.npvB.toFixed(2)}B`}
            accent="cyan"
            help={`Discounted cash flow over 10y patent life: revenue ramps to peak over ${sliders.timeToPeakYears}y, after ${sliders.cogsPct.toFixed(0)}% COGS and ${sliders.taxRate.toFixed(0)}% tax, discounted at ${sliders.discountRate}%/yr WACC. Each year's cash flow ÷ (1+discount)^year, then summed.`}
          />
          <ResultStat
            label="vs market cap"
            value={`${(calc.npvMultiple * 100).toFixed(0)}%`}
            accent={calc.npvMultiple > 0.5 ? 'emerald' : undefined}
            help={`Drug NPV ($${calc.npvB.toFixed(2)}B) ÷ current market cap ($${((marketCapM ?? 0) / 1000).toFixed(2)}B). >100% means the drug alone is worth more than the company's market cap. >50% means it's a material driver.`}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Slider with full provenance display:
 *  - Label + tooltip explaining what the field MEANS
 *  - Current value displayed prominently; turns amber when modified
 *  - Shows AI default next to current value when modified
 *  - Provenance source pill (Orange Book / OpenFDA / etc) with confidence
 *  - Drug-specific context line (the AI's actual estimate + reasoning)
 */
function ProvSlider({
  label, value, aiDefault, min, max, step, unit, help, onChange,
  display, displayDelta, provenance, context,
}: {
  label: string;
  value: number;
  aiDefault: number;
  min: number; max: number; step: number; unit?: string;
  help?: string;
  onChange: (v: number) => void;
  display?: (v: number) => string;
  displayDelta?: (v: number, ai: number) => string;
  provenance?: ProvenanceEntry;
  context?: string;
}) {
  const modified = Math.abs(value - aiDefault) > 0.001;
  const valueDisplay = display ? display(value) : `${value}${unit ?? ''}`;
  const fullDisplay = modified && displayDelta
    ? displayDelta(value, aiDefault)
    : valueDisplay;

  return (
    <div>
      {/* Label row */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
          {label}
          {help && <InfoTooltip text={help} position="top" />}
        </span>
        <span className={`font-mono text-xs ${modified ? 'text-amber-200' : 'text-neutral-200'}`}>
          {fullDisplay}
        </span>
      </div>

      {/* Slider track — turns amber when off-default to make changes obvious */}
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`w-full ${modified ? 'accent-amber-400' : 'accent-cyan-500'}`}
      />

      {/* Provenance + context line — the “why this number” explanation */}
      {(provenance || context) && (
        <div className="mt-1 flex items-start gap-1.5 text-[10px]">
          {provenance ? (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 ${CONFIDENCE_TONE[provenance.confidence]}`}
                  title={`Source: ${SOURCE_LABEL[provenance.source]} · confidence: ${provenance.confidence}`}>
              <ShieldCheck className="h-2.5 w-2.5" />
              <span className={SOURCE_TONE[provenance.source]}>{SOURCE_LABEL[provenance.source]}</span>
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-300"
                  title="No verified source — value is an AI estimate or industry default">
              <Sparkles className="h-2.5 w-2.5" />
              AI default
            </span>
          )}
          {context && (
            <span className="text-neutral-500 leading-snug pt-0.5">{context}</span>
          )}
          {!context && provenance?.citation && (
            <span className="text-neutral-500 leading-snug pt-0.5">{provenance.citation}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, accent, help }: { label: string; value: string; accent?: string; help?: string }) {
  const colorClass = accent === 'cyan' ? 'text-cyan-200' : accent === 'emerald' ? 'text-emerald-200' : 'text-neutral-100';
  return (
    <div className="rounded border border-border/40 bg-bg/40 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
        {help && <InfoTooltip text={help} position="top" />}
      </div>
      <div className={`mt-0.5 text-base font-mono ${colorClass}`}>{value}</div>
    </div>
  );
}
