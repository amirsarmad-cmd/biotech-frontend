'use client';

import { Database, FileCheck, FlaskConical, AlertCircle, ExternalLink } from 'lucide-react';
import type { VerifiedFacts } from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface Props {
  verifiedFacts?: VerifiedFacts | null;
  confidenceScore?: number | null;
}

/**
 * Surfaces Layer 1 (official structured) data: OpenFDA, ClinicalTrials.gov.
 * This is the data the LLM was forced to anchor on. When present, downstream
 * provenance-tagged values should be more trustworthy than pure LLM output.
 *
 * The user sees:
 *   - Which sources were fetched + which succeeded
 *   - Drug label summary (boxed warnings, indications, manufacturer)
 *   - Approval history (count of approvals, CRLs, latest action date)
 *   - Recent clinical trials matching this drug
 *   - Confidence score rollup
 */
export function VerifiedFactsPanel({ verifiedFacts, confidenceScore }: Props) {
  if (!verifiedFacts || !verifiedFacts._sources_succeeded?.length) {
    // No FDA/CT.gov data found — render a transparency note instead of hiding.
    // This matters: users should know when the rNPV is purely LLM-driven.
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-300" />
          <span className="font-medium text-amber-200">No official FDA / ClinicalTrials.gov data available for this drug</span>
        </div>
        <p className="mt-1 pl-6 text-xs text-amber-100/70">
          This drug isn&apos;t indexed in OpenFDA or ClinicalTrials.gov yet (typical for pre-IND or early-pipeline candidates).
          The economic analysis below is entirely LLM-driven — treat numbers as estimates with wider uncertainty bands.
        </p>
      </div>
    );
  }

  const succeededSet = new Set(verifiedFacts._sources_succeeded || []);
  const label = verifiedFacts.drug_label;
  const history = verifiedFacts.approval_history;
  const trials = verifiedFacts.clinical_trials;
  const confidencePct = confidenceScore != null ? Math.round(confidenceScore * 100) : null;

  let confidenceTone: 'green' | 'violet' | 'amber' | 'red' = 'amber';
  if (confidenceScore != null) {
    if (confidenceScore >= 0.75) confidenceTone = 'green';
    else if (confidenceScore >= 0.5) confidenceTone = 'violet';
    else if (confidenceScore >= 0.3) confidenceTone = 'amber';
    else confidenceTone = 'red';
  }
  const confidenceColor = {
    green: 'text-emerald-300',
    violet: 'text-violet-300',
    amber: 'text-amber-300',
    red: 'text-red-300',
  }[confidenceTone];

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-medium text-neutral-200">Verified facts (Layer 1)</h3>
          <InfoTooltip
            text="Official structured data from OpenFDA + ClinicalTrials.gov fetched before the LLM analysis ran. The LLM was instructed to anchor its estimates on these facts and not contradict them. Higher source coverage = more trustworthy NPV."
            position="bottom"
          />
        </div>
        {confidencePct != null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">Analysis confidence</div>
            <div className={`text-lg font-semibold ${confidenceColor}`}>{confidencePct}%</div>
          </div>
        )}
      </div>

      {/* Sources bar */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(['openfda_drug_label', 'openfda_drugsfda', 'clinicaltrials_gov'] as const).map((src) => {
          const ok = succeededSet.has(src);
          const label = src === 'openfda_drug_label' ? 'OpenFDA Label'
                      : src === 'openfda_drugsfda' ? 'Drugs@FDA'
                      : 'ClinicalTrials.gov';
          return (
            <span
              key={src}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-neutral-700 bg-bg/40 text-neutral-500'
              }`}
            >
              {ok ? '✓' : '·'} {label}
            </span>
          );
        })}
      </div>

      {/* Drug label section */}
      {label && (
        <div className="rounded-md border border-border/50 bg-bg/30 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 font-medium text-cyan-200">
            <FileCheck className="h-3.5 w-3.5" />
            FDA-approved drug label
          </div>
          {label.brand_names && label.brand_names.length > 0 && (
            <div><span className="text-neutral-500">Brand:</span> {label.brand_names.join(', ')}</div>
          )}
          {label.generic_names && label.generic_names.length > 0 && (
            <div><span className="text-neutral-500">Generic:</span> {label.generic_names.join(', ')}</div>
          )}
          {label.manufacturer_name && label.manufacturer_name.length > 0 && (
            <div><span className="text-neutral-500">Manufacturer:</span> {label.manufacturer_name[0]}</div>
          )}
          {label.indications_and_usage && (
            <div>
              <span className="text-neutral-500">Indications:</span>{' '}
              <span className="text-neutral-300">{label.indications_and_usage.slice(0, 200)}{label.indications_and_usage.length > 200 ? '…' : ''}</span>
            </div>
          )}
          {label.boxed_warning && (
            <div className="mt-1 rounded border border-red-500/30 bg-red-500/5 p-2">
              <span className="font-medium text-red-300">Boxed warning:</span>{' '}
              <span className="text-red-100/80">{label.boxed_warning.slice(0, 250)}{label.boxed_warning.length > 250 ? '…' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Approval history */}
      {history && (
        <div className="rounded-md border border-border/50 bg-bg/30 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 font-medium text-cyan-200">
            <FileCheck className="h-3.5 w-3.5" />
            Drugs@FDA submission history
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] text-neutral-500">Approvals</div>
              <div className="font-mono text-emerald-300">{history.approval_count ?? 0}</div>
            </div>
            <div>
              <div className="text-[10px] text-neutral-500">CRLs / Withdrawals</div>
              <div className="font-mono text-amber-300">{history.rejection_count ?? 0}</div>
            </div>
            <div>
              <div className="text-[10px] text-neutral-500">Earliest approval</div>
              <div className="font-mono text-neutral-300">{history.earliest_approval || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Clinical trials */}
      {trials && trials.studies && trials.studies.length > 0 && (
        <div className="rounded-md border border-border/50 bg-bg/30 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 font-medium text-cyan-200">
            <FlaskConical className="h-3.5 w-3.5" />
            ClinicalTrials.gov — {trials.total_count} matching studies
          </div>
          <div className="space-y-1.5">
            {trials.studies.slice(0, 4).map((s) => (
              <div key={s.nct_id} className="border-l-2 border-cyan-500/30 pl-2">
                <div className="flex items-center gap-2">
                  {s._url ? (
                    <a href={s._url} target="_blank" rel="noopener noreferrer" className="font-mono text-cyan-400 hover:underline">
                      {s.nct_id} <ExternalLink className="inline h-2.5 w-2.5" />
                    </a>
                  ) : (
                    <span className="font-mono text-cyan-400">{s.nct_id}</span>
                  )}
                  {s.phase && <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 text-[10px] text-violet-200">{s.phase}</span>}
                  <span className={`text-[10px] ${
                    s.status === 'COMPLETED' ? 'text-emerald-400' :
                    s.status === 'RECRUITING' || s.status === 'ACTIVE_NOT_RECRUITING' ? 'text-cyan-400' :
                    s.status === 'TERMINATED' || s.status === 'WITHDRAWN' ? 'text-red-400' :
                    'text-neutral-400'
                  }`}>{s.status}</span>
                </div>
                <div className="text-neutral-300 leading-tight">{s.brief_title}</div>
                <div className="text-[10px] text-neutral-500">
                  {s.enrollment ? `n=${s.enrollment}` : '—'}{s.primary_completion_date ? ` · primary completion ${s.primary_completion_date}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-neutral-600 leading-tight">
        Sources fetched in {verifiedFacts._fetch_duration_ms ?? '?'}ms · these facts anchor the rNPV analysis below
      </div>
    </div>
  );
}
