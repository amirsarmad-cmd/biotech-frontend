'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sliders, RotateCcw, TrendingUp } from 'lucide-react';
import { InfoTooltip } from './tooltips';

interface Props {
  ticker: string;
  /** Drug name from npv catalyst */
  drugName?: string | null;
  /** Initial economics from backend NPV computation */
  initial: {
    peakSalesB?: number | null;
    patientPopK?: number | null;       // estimated patients in 000s
    annualCostUsd?: number | null;     // per-patient annual cost
    penetrationPct?: number | null;
    timeToPeakYears?: number | null;
    discountRate?: number | null;
    taxRate?: number | null;
    cogsPct?: number | null;
    pApproval?: number | null;
    pCommercial?: number | null;
    marketCapM?: number | null;
  };
}

interface Sliders {
  peakSalesB: number;
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
  peakSalesB: 1.0,
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

export function NPVSlidersPanel({ ticker, drugName, initial }: Props) {
  // Initialize sliders from backend values, fallback to DEFAULTS
  const [sliders, setSliders] = useState<Sliders>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`npv-sliders:${ticker}:${drugName || 'default'}`);
        if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
      } catch { /* ignore */ }
    }
    return {
      peakSalesB: initial.peakSalesB ?? DEFAULTS.peakSalesB,
      pApproval: initial.pApproval ?? DEFAULTS.pApproval,
      pCommercial: initial.pCommercial ?? DEFAULTS.pCommercial,
      patientPopK: initial.patientPopK ?? DEFAULTS.patientPopK,
      annualCostUsd: initial.annualCostUsd ?? DEFAULTS.annualCostUsd,
      penetrationPct: (initial.penetrationPct != null ? initial.penetrationPct : DEFAULTS.penetrationPct),
      timeToPeakYears: initial.timeToPeakYears ?? DEFAULTS.timeToPeakYears,
      discountRate: (initial.discountRate != null ? initial.discountRate * 100 : DEFAULTS.discountRate),
      taxRate: (initial.taxRate != null ? initial.taxRate * 100 : DEFAULTS.taxRate),
      cogsPct: (initial.cogsPct != null ? initial.cogsPct * 100 : DEFAULTS.cogsPct),
    };
  });

  // Persist on change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`npv-sliders:${ticker}:${drugName || 'default'}`, JSON.stringify(sliders));
    } catch { /* ignore */ }
  }, [ticker, drugName, sliders]);

  const reset = () => {
    setSliders({
      peakSalesB: initial.peakSalesB ?? DEFAULTS.peakSalesB,
      pApproval: initial.pApproval ?? DEFAULTS.pApproval,
      pCommercial: initial.pCommercial ?? DEFAULTS.pCommercial,
      patientPopK: initial.patientPopK ?? DEFAULTS.patientPopK,
      annualCostUsd: initial.annualCostUsd ?? DEFAULTS.annualCostUsd,
      penetrationPct: (initial.penetrationPct != null ? initial.penetrationPct : DEFAULTS.penetrationPct),
      timeToPeakYears: initial.timeToPeakYears ?? DEFAULTS.timeToPeakYears,
      discountRate: (initial.discountRate != null ? initial.discountRate * 100 : DEFAULTS.discountRate),
      taxRate: (initial.taxRate != null ? initial.taxRate * 100 : DEFAULTS.taxRate),
      cogsPct: (initial.cogsPct != null ? initial.cogsPct * 100 : DEFAULTS.cogsPct),
    });
  };

  // Live NPV calculation in browser
  const calc = useMemo(() => {
    // Two ways to compute peak sales:
    // 1. Direct: user adjusted peakSalesB
    // 2. Bottom-up: patient_pop * penetration * annual_cost
    const bottomUpPeakB = (sliders.patientPopK * 1000 * (sliders.penetrationPct / 100) * sliders.annualCostUsd) / 1e9;
    
    // Use bottom-up as the primary (since user can drive it via population/cost sliders)
    const peakSalesB = bottomUpPeakB;
    
    // Risk-adjusted peak: peak * p_approval * p_commercial
    const riskAdjustedPeakB = peakSalesB * sliders.pApproval * sliders.pCommercial;
    
    // Annual gross profit at peak: peak * (1 - cogs)
    const annualGrossProfitB = riskAdjustedPeakB * (1 - sliders.cogsPct / 100);
    
    // Annual after-tax cash flow: gross profit * (1 - tax)
    const annualAfterTaxB = annualGrossProfitB * (1 - sliders.taxRate / 100);
    
    // 10-year exclusivity period for protection (typical)
    const exclusivityYears = 10;
    
    // Discount each year of cash flow
    let totalDiscountedB = 0;
    const discountFactor = sliders.discountRate / 100;
    const ttp = sliders.timeToPeakYears;
    
    for (let year = 1; year <= exclusivityYears; year++) {
      // Sales ramp from 0 to peak over `ttp` years, then plateau
      const ramp = Math.min(year / ttp, 1.0);
      const yearAfterTax = annualAfterTaxB * ramp;
      const discounted = yearAfterTax / Math.pow(1 + discountFactor, year);
      totalDiscountedB += discounted;
    }
    
    const npvB = totalDiscountedB;
    const marketCapB = (initial.marketCapM ?? 0) / 1000;
    const npvMultiple = marketCapB > 0 ? npvB / marketCapB : 0;
    
    return { peakSalesB, riskAdjustedPeakB, annualAfterTaxB, npvB, npvMultiple };
  }, [sliders, initial.marketCapM]);

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base">
          <Sliders className="h-4 w-4 text-cyan-400" />
          NPV Calculator
          <InfoTooltip
            text="Live NPV calculation. Adjust drug economics (patient population, treatment cost, penetration), risk parameters (probabilities, discount rate), and timing (time to peak sales). Saved to your browser."
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Drug economics */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Drug economics</div>
          <Slider
            label="Patient population (US)"
            value={sliders.patientPopK}
            min={1} max={5000} step={5} unit="K"
            help="Estimated treatable patient population in the US (thousands). Drives peak sales."
            onChange={v => setSliders(s => ({ ...s, patientPopK: v }))}
            display={(v) => v < 1000 ? `${v.toFixed(0)}K` : `${(v / 1000).toFixed(1)}M`}
          />
          <Slider
            label="Penetration (%)"
            value={sliders.penetrationPct}
            min={1} max={80} step={1} unit="%"
            help="Share of treatable population this drug captures at peak. Best-in-class rare disease drugs hit 30-50%; competitive markets see 10-20%."
            onChange={v => setSliders(s => ({ ...s, penetrationPct: v }))}
          />
          <Slider
            label="Annual cost per patient"
            value={sliders.annualCostUsd}
            min={1000} max={1_000_000} step={1000} unit="$"
            help="Annual list price per patient. Rare disease orphan drugs: $200K-$500K. Mass market biologics: $30K-$100K. Specialty oral: $5K-$50K."
            onChange={v => setSliders(s => ({ ...s, annualCostUsd: v }))}
            display={(v) => v >= 1_000_000 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
          />
        </div>

        {/* Risk & timing */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Risk & timing</div>
          <Slider
            label="P(approval)"
            value={sliders.pApproval * 100}
            min={5} max={95} step={5} unit="%"
            help="Probability of regulatory approval. AI estimate from analysis above. Phase 3 readouts in oncology: 30-50%. Rare disease: 60-80%."
            onChange={v => setSliders(s => ({ ...s, pApproval: v / 100 }))}
          />
          <Slider
            label="P(commercial success | approval)"
            value={sliders.pCommercial * 100}
            min={20} max={100} step={5} unit="%"
            help="Probability the drug succeeds commercially conditional on approval. Best-in-class: 80-90%. Me-too: 40-60%. Crowded markets: 30-50%."
            onChange={v => setSliders(s => ({ ...s, pCommercial: v / 100 }))}
          />
          <Slider
            label="Time to peak sales (yrs)"
            value={sliders.timeToPeakYears}
            min={1} max={10} step={1} unit="y"
            help="Years from launch to peak sales. Specialty: 3-5 years. Mass market: 5-7. Slow uptake: 7-10."
            onChange={v => setSliders(s => ({ ...s, timeToPeakYears: v }))}
          />
          <Slider
            label="Discount rate"
            value={sliders.discountRate}
            min={5} max={25} step={0.5} unit="%"
            help="WACC for biotech. Typical: 10-15%. High-risk small caps: 15-20%."
            onChange={v => setSliders(s => ({ ...s, discountRate: v }))}
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
          <ResultStat label="Peak sales" value={`$${calc.peakSalesB.toFixed(2)}B`} help="Patients × penetration × annual cost" />
          <ResultStat label="Risk-adj peak" value={`$${calc.riskAdjustedPeakB.toFixed(2)}B`} help="Peak × P(approval) × P(commercial)" />
          <ResultStat label="Drug NPV" value={`$${calc.npvB.toFixed(2)}B`} accent="cyan" help="Discounted cash flow over 10y patent life" />
          <ResultStat label="vs market cap" value={`${(calc.npvMultiple * 100).toFixed(0)}%`} accent={calc.npvMultiple > 0.5 ? "emerald" : undefined} help="If >50%, this drug alone could materially move the stock" />
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, help, onChange, display }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  help?: string; onChange: (v: number) => void;
  display?: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
          {label}
          {help && <InfoTooltip text={help} position="top" />}
        </span>
        <span className="font-mono text-xs text-neutral-200">
          {display ? display(value) : `${value}${unit ?? ''}`}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-cyan-500"
      />
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
