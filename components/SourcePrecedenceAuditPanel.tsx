'use client';

import { Shield, ArrowRight } from 'lucide-react';
import type { SourcePrecedenceAudit } from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface Props {
  audit?: SourcePrecedenceAudit | null;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  orange_book: { label: 'Orange Book', color: 'text-emerald-300' },
  openfda_drugsfda: { label: 'Drugs@FDA', color: 'text-emerald-300' },
  openfda_drug_label: { label: 'OpenFDA label', color: 'text-emerald-300' },
  clinicaltrials_gov: { label: 'ClinicalTrials.gov', color: 'text-emerald-300' },
  sec_edgar: { label: 'SEC EDGAR', color: 'text-emerald-300' },
};

const fmtVal = (v: unknown): string => {
  if (v == null) return 'null';
  if (typeof v === 'number') return v.toLocaleString('en-US');
  if (typeof v === 'string') return v.length > 30 ? v.substring(0, 30) + '…' : v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return JSON.stringify(v).substring(0, 30);
};

/**
 * Surfaces which verified-source values overrode LLM inference.
 *
 * Per ChatGPT pass-3 critique #3: verified facts MUST override LLM guesses
 * on the same field. The audit shows users exactly which fields were
 * corrected and why — building trust that the system isn't relying on
 * LLM inference where authoritative data exists.
 */
export function SourcePrecedenceAuditPanel({ audit }: Props) {
  if (!audit || !audit.overrides_applied || audit.overrides_applied.length === 0) {
    // Show muted "no overrides" state if checks were performed
    if (audit?.checks_performed && audit.checks_performed.length > 0) {
      return (
        <div className="rounded-md border border-border/30 bg-bg/20 px-3 py-2 text-[10px] text-neutral-500">
          <Shield className="inline h-3 w-3 mr-1" />
          {audit.checks_performed.length} source-precedence checks performed · no LLM values needed override
        </div>
      );
    }
    return null;
  }

  return (
    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-emerald-300" />
        <h4 className="text-xs font-medium text-emerald-200">
          Verified-source overrides
        </h4>
        <span className="text-[10px] text-neutral-500">
          ({audit.overrides_applied.length} field{audit.overrides_applied.length === 1 ? '' : 's'} corrected)
        </span>
        <InfoTooltip
          text="When the LLM inference disagrees with an authoritative source (Orange Book, FDA, ClinicalTrials.gov, SEC), the verified value wins. This panel shows which fields were corrected and the original LLM value, so you can audit the precedence chain."
          position="bottom"
        />
      </div>
      <div className="space-y-1.5">
        {audit.overrides_applied.map((o, i) => {
          const src = SOURCE_LABELS[o.verified_source] || { label: o.verified_source, color: 'text-neutral-300' };
          return (
            <div key={i} className="text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-neutral-300">{o.field}</span>
                <span className="text-neutral-500 line-through font-mono text-[10px]">
                  {fmtVal(o.from_value)}
                </span>
                <ArrowRight className="h-3 w-3 text-neutral-500" />
                <span className={`font-mono ${src.color}`}>{fmtVal(o.to_value)}</span>
                <span className={`text-[10px] ${src.color}`}>· {src.label}</span>
              </div>
              <div className="ml-3 text-[10px] text-neutral-500">{o.reason}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
