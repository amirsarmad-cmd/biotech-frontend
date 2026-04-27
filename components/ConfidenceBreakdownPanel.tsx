'use client';

import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { InfoTooltip } from './tooltips';
import type { DrugEconomicsV2 } from '@/lib/api';

interface Props {
  economicsV2?: DrugEconomicsV2 | null;
}

type CategoryKey = 'clinical' | 'regulatory' | 'market' | 'pricing' | 'penetration' | 'dilution';

interface CategoryMeta {
  label: string;
  description: string;
  whatItMeans: string;
}

const CATEGORY_META: Record<CategoryKey, CategoryMeta> = {
  clinical: {
    label: 'Clinical',
    description: 'Catalyst outcome probability — split into event-occurs × positive-given-occurs',
    whatItMeans:
      'How well-anchored the clinical-outcome probabilities are. Sources: industry success-rate tables (Phase 3 to approval ~50-65%), benchmark drugs in same modality and indication, LLM analysis of trial design quality. HIGH means a comparable drug exists with similar trial design; LOW means we\'re extrapolating from limited analogues.',
  },
  regulatory: {
    label: 'Regulatory',
    description: 'Patent expiry, launch timing, LOE drop-off',
    whatItMeans:
      'Confidence in regulatory facts. Sources: Orange Book for patent expirations on APPROVED drugs, LLM for launch timing on pre-approval drugs. For pre-approval drugs this score is mechanically lower because Orange Book has nothing yet — that\'s expected, not a flaw.',
  },
  market: {
    label: 'Market',
    description: 'Addressable patient population US + global',
    whatItMeans:
      'Confidence in market sizing. Sources: epidemiology research, sometimes user-provided notes flagged as user_research. For rare diseases the LLM tends to be reasonably accurate (epidemiology is well-published); for novel indications less so. user_research flags = HIGH confidence (you anchored it).',
  },
  pricing: {
    label: 'Pricing',
    description: 'Net realized prices US + ex-US, gross-to-net adjustments, SOC comparator',
    whatItMeans:
      'The weakest area for most pre-approval drugs. Sources: LLM analysis using comparable approved drugs in the same modality and indication. For approved drugs we sometimes have actual list prices; for pipeline drugs we estimate gross-to-net (~50-70% for branded small molecules, 70-85% for biologics, 80-95% for orphans). Sanity-check pricing assumptions.',
  },
  penetration: {
    label: 'Penetration',
    description: 'Peak market share, time-to-peak, commercial success probability, COGS',
    whatItMeans:
      'How confident we are in commercial uptake assumptions. Sources: LLM with competitive analysis. Best-in-class first-line drugs hit 30-50% peak share; me-too drugs in crowded markets often <15%. This is judgment-heavy — question it especially if a major competitor is also launching.',
  },
  dilution: {
    label: 'Dilution',
    description: 'Capital structure (shares, runway) from SEC EDGAR',
    whatItMeans:
      'Confidence in capital structure. Sources: SEC EDGAR XBRL company facts (cash, debt, shares outstanding) — these are HIGH confidence for any public US company. Should be near 100% if shares_outstanding_m and cash_runway_months were both retrievable.',
  },
};

const CATEGORY_ORDER: CategoryKey[] = [
  'clinical', 'regulatory', 'market', 'pricing', 'penetration', 'dilution',
];

function scoreTone(score: number) {
  if (score >= 0.7) return { bar: 'bg-emerald-400', text: 'text-emerald-300', label: 'high' };
  if (score >= 0.4) return { bar: 'bg-amber-400', text: 'text-amber-300', label: 'medium' };
  return { bar: 'bg-red-400', text: 'text-red-300', label: 'low' };
}

/**
 * Confidence breakdown — splits the single rolled-up confidence_score into
 * 6 categories per ChatGPT pass-4 critique #6:
 *   "For NTLA, confidence may be high for trial status and cash, medium for
 *    commercial penetration, and low for net pricing. A single blended score
 *    hides that."
 *
 * Renders 6 mini-bars side by side. Each shows score % + populated/total
 * fields + tooltip explaining what the category covers.
 */
export function ConfidenceBreakdownPanel({ economicsV2 }: Props) {
  const breakdown = economicsV2?.confidence_breakdown;
  const overall = economicsV2?.confidence_score;

  if (!breakdown) {
    // Backend hasn't populated this yet (cached pre-deploy).
    // Don't render anything — the rolled-up score is shown elsewhere.
    return null;
  }

  // Find weakest category for emphasis
  const allScores = CATEGORY_ORDER
    .map(k => ({ k, score: breakdown[k]?.score ?? 0 }))
    .sort((a, b) => a.score - b.score);
  const weakest = allScores[0];
  const strongest = allScores[allScores.length - 1];

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-cyan-300" />
        <h3 className="text-sm font-medium text-neutral-200">Confidence by category</h3>
        <InfoTooltip
          text={
            'Splits the single confidence score into 6 categories so you can see WHICH inputs to trust and which to question. ' +
            'For most pre-approval biotech, clinical and dilution will be HIGH (sourced from ClinicalTrials.gov + SEC filings); ' +
            'pricing and penetration will be MEDIUM/LOW (sourced from LLM inference because no real-world data exists yet). ' +
            'A single blended score hides this. If pricing is LOW, treat the rNPV as a range, not a point estimate.'
          }
          position="bottom"
        />
        {overall != null && (
          <span className="ml-auto text-[10px] text-neutral-500">
            overall: <span className={scoreTone(overall).text}>{(overall * 100).toFixed(0)}%</span>
          </span>
        )}
      </div>

      {/* 6 mini-bars */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORY_ORDER.map(cat => {
          const data = breakdown[cat];
          if (!data) return null;
          const tone = scoreTone(data.score);
          return (
            <div key={cat} className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
                {CATEGORY_META[cat].label}
                <InfoTooltip
                  text={`${CATEGORY_META[cat].label}: ${CATEGORY_META[cat].description}.\n\nScore: ${(data.score * 100).toFixed(0)}% · ${data.n_populated}/${data.n_fields} fields populated.\n\n${CATEGORY_META[cat].whatItMeans}`}
                  position="top"
                />
              </div>
              <div className={`font-mono text-base ${tone.text}`}>
                {(data.score * 100).toFixed(0)}%
              </div>
              {/* Bar */}
              <div className="h-1.5 rounded-full bg-neutral-800/60 overflow-hidden">
                <div
                  className={`h-full ${tone.bar} transition-all`}
                  style={{ width: `${data.score * 100}%` }}
                />
              </div>
              <div className="text-[9px] text-neutral-600">
                {data.n_populated}/{data.n_fields} fields · {tone.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interpretation hint — surface the weakest area */}
      {weakest && weakest.score < 0.4 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-300" />
          <div className="text-amber-100/80 leading-snug">
            <span className="font-medium">{CATEGORY_META[weakest.k].label}</span> is the weakest input
            ({(weakest.score * 100).toFixed(0)}%).{' '}
            <span className="text-neutral-400">
              {weakest.k === 'pricing' && 'Net realized pricing depends on rebate negotiations and payer mix that haven\'t happened yet.'}
              {weakest.k === 'penetration' && 'Peak market share assumes a particular competitive landscape — challenge this if a major competitor is launching.'}
              {weakest.k === 'regulatory' && 'For pre-approval drugs this score is naturally lower (no Drugs@FDA history to anchor on).'}
              {weakest.k === 'market' && 'Addressable population estimates can vary by 2-3× depending on definition. Sanity-check with epidemiology data.'}
              {weakest.k === 'clinical' && 'Trial fundamentals are missing — consider adding research notes to the corpus.'}
              {weakest.k === 'dilution' && 'Capital structure incomplete — SEC filings may be unavailable for non-US listings.'}
            </span>
          </div>
        </div>
      )}

      {/* Strong-area callout when relevant */}
      {strongest && strongest.score >= 0.85 && weakest.score < 0.4 && (
        <div className="text-[10px] text-neutral-500 italic">
          {CATEGORY_META[strongest.k].label} is well-anchored ({(strongest.score * 100).toFixed(0)}%) — that part of the analysis you can trust.
        </div>
      )}
    </div>
  );
}
