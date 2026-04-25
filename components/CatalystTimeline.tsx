'use client';

import { useMemo, useState } from 'react';
import { Calendar, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { InfoTooltip } from './tooltips';

interface Catalyst {
  type: string;
  date: string;
  probability: number;
  description?: string;
  drug_name?: string | null;
}

interface Props {
  ticker: string;
  catalysts: Catalyst[];
  marketCapM: number;
  /** Optional: this stock's primary NPV for blending */
  primaryNpvB?: number | null;
  primaryProbApproval?: number;
}

/**
 * Reference dataset of typical % moves for each catalyst type.
 * Sources: empirical biotech catalyst studies (Pharmagellan, Endpoints News).
 * Format: [up_pct, down_pct] — used when stock's own historical moves not available.
 */
const REFERENCE_MOVES: Record<string, [number, number]> = {
  'FDA Decision':              [25, -20],
  'PDUFA Decision':            [25, -20],
  'AdComm':                    [15, -12],
  'Advisory Committee':        [15, -12],
  'Phase 3 Readout':           [35, -30],
  'Phase 3':                   [35, -30],
  'Phase 2 Readout':           [25, -20],
  'Phase 2':                   [25, -20],
  'Phase 1 Readout':           [15, -12],
  'Phase 1':                   [15, -12],
  'Phase 1/2 Readout':         [18, -15],
  'Phase 1/2':                 [18, -15],
  'Phase 2/3 Readout':         [30, -25],
  'Phase 1/2/3 Readout':       [25, -22],
  'Clinical Trial':            [12, -10],
  'Clinical Trial Readout':    [20, -18],
  'NDA submission':            [8, -5],
  'BLA submission':            [8, -5],
  'sBLA submission':           [5, -3],
  'sNDA submission':           [5, -3],
  'IND submission':            [3, -2],
  'IND/CTA submission':        [3, -2],
  'Regulatory Decision':       [22, -18],
  'Regulatory Submission':     [6, -4],
  'Regulatory Meeting/Discussion': [4, -3],
  'Partnership':               [10, -3],
  'Earnings':                  [6, -5],
  'Product Launch':            [10, -8],
  'Commercial Launch':         [10, -8],
};

function getReferenceMove(catalystType: string): [number, number] {
  // Try exact match first, then case-insensitive
  if (REFERENCE_MOVES[catalystType]) return REFERENCE_MOVES[catalystType];
  for (const k of Object.keys(REFERENCE_MOVES)) {
    if (k.toLowerCase() === catalystType.toLowerCase()) return REFERENCE_MOVES[k];
  }
  // Fuzzy match
  const lower = catalystType.toLowerCase();
  if (lower.includes('phase 3') || lower.includes('phase iii')) return REFERENCE_MOVES['Phase 3 Readout'];
  if (lower.includes('phase 2')) return REFERENCE_MOVES['Phase 2 Readout'];
  if (lower.includes('phase 1')) return REFERENCE_MOVES['Phase 1 Readout'];
  if (lower.includes('fda') || lower.includes('pdufa')) return REFERENCE_MOVES['FDA Decision'];
  if (lower.includes('adcomm') || lower.includes('advisory')) return REFERENCE_MOVES['AdComm'];
  if (lower.includes('partnership')) return REFERENCE_MOVES['Partnership'];
  if (lower.includes('earnings')) return REFERENCE_MOVES['Earnings'];
  if (lower.includes('launch')) return REFERENCE_MOVES['Product Launch'];
  // Default fallback
  return [10, -8];
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

function fmtPct(v: number, decimals = 0): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}

export function CatalystTimeline({ ticker, catalysts, marketCapM, primaryNpvB }: Props) {
  const [showRef, setShowRef] = useState(true);
  const [showWeights, setShowWeights] = useState(false);
  
  // Per-catalyst probability overrides, persisted to localStorage by (ticker, catalyst_index)
  const [probOverrides, setProbOverrides] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(`prob-overrides:${ticker}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  
  const setOverride = (key: string, prob: number) => {
    const next = { ...probOverrides, [key]: prob };
    setProbOverrides(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`prob-overrides:${ticker}`, JSON.stringify(next));
      } catch { /* ignore */ }
    }
  };
  
  const resetOverride = (key: string) => {
    const next = { ...probOverrides };
    delete next[key];
    setProbOverrides(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`prob-overrides:${ticker}`, JSON.stringify(next));
      } catch { /* ignore */ }
    }
  };

  // Build enriched catalyst rows
  const rows = useMemo(() => {
    if (!catalysts || catalysts.length === 0) return [];

    return catalysts
      .map((c, idx) => {
        const key = `${c.type}-${c.date}-${idx}`;
        const baseProb = c.probability;
        const effectiveProb = probOverrides[key] != null ? probOverrides[key] : baseProb;
        const [upPct, downPct] = getReferenceMove(c.type);
        const days = daysUntil(c.date);
        const expectedMovePct = effectiveProb * upPct + (1 - effectiveProb) * downPct;
        const expectedNpvImpactM = (expectedMovePct / 100) * marketCapM;
        const isOverridden = probOverrides[key] != null;

        return {
          idx,
          key,
          ...c,
          baseProb,
          effectiveProb,
          isOverridden,
          upPct,
          downPct,
          days,
          expectedMovePct,
          expectedNpvImpactM,
        };
      })
      .sort((a, b) => a.days - b.days);
  }, [catalysts, marketCapM, probOverrides]);

  // Multi-catalyst aggregate: probability-weighted total expected % move (additive but capped at -50%/+150%)
  const aggregate = useMemo(() => {
    if (!rows.length) return null;
    const totalExpectedPct = rows.reduce((acc, r) => acc + r.expectedMovePct, 0);
    const totalExpectedNpvImpactM = rows.reduce((acc, r) => acc + r.expectedNpvImpactM, 0);
    // Sum of upside if all hit
    const upsideAllPct = rows.reduce((acc, r) => acc + r.upPct, 0);
    const downsideAllPct = rows.reduce((acc, r) => acc + r.downPct, 0);
    return {
      totalExpectedPct: Math.max(-90, Math.min(300, totalExpectedPct)),
      totalExpectedNpvImpactM,
      upsideAllPct: Math.min(300, upsideAllPct),
      downsideAllPct: Math.max(-90, downsideAllPct),
      n: rows.length,
    };
  }, [rows]);

  if (rows.length === 0) {
    return null;
  }

  const helpText = "Every upcoming catalyst with the typical magnitude of move based on historical biotech catalyst data. The 'expected move' is the probability-weighted average. Click 'Adjust weights' to override individual probabilities — overrides save to your browser. Reference moves: FDA Decision ±25/-20%, Phase 3 ±35/-30%, AdComm ±15/-12%, etc.";

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-violet-400" />
          Catalyst Timeline
          <InfoTooltip text={helpText} position="bottom" />
          <span className="ml-2 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">{rows.length} upcoming</span>
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWeights(s => !s)}
            className={`text-xs transition ${showWeights ? 'text-violet-300' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            {showWeights ? '✓ Adjust weights' : 'Adjust weights'}
          </button>
          <button
            onClick={() => setShowRef(s => !s)}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition"
          >
            {showRef ? 'Hide reference' : 'Show reference'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="min-w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-border/50">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Type</th>
              <th className="px-2 py-2 text-left">Drug / Description</th>
              <th className="px-2 py-2 text-right">Days</th>
              <th className="px-2 py-2 text-right">Prob</th>
              {showRef && (
                <>
                  <th className="px-2 py-2 text-right text-emerald-300/60">Up move</th>
                  <th className="px-2 py-2 text-right text-red-300/60">Down move</th>
                </>
              )}
              <th className="px-2 py-2 text-right">Expected %</th>
              <th className="px-2 py-2 text-right">Exp NPV impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map(r => (
              <tr key={`${r.type}-${r.date}-${r.idx}`} className="hover:bg-bg/40 transition">
                <td className="px-2 py-2 font-mono text-neutral-300">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td className="px-2 py-2">
                  <span className="text-violet-300">{r.type}</span>
                </td>
                <td className="px-2 py-2 text-neutral-400 max-w-xs truncate" title={r.description || r.drug_name || ''}>
                  {r.drug_name || r.description?.slice(0, 60) || '—'}
                </td>
                <td className="px-2 py-2 text-right font-mono text-neutral-400">{r.days >= 0 ? `+${r.days}d` : `${r.days}d`}</td>
                <td className="px-2 py-2 text-right font-mono">
                  {showWeights ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round(r.effectiveProb * 100)}
                        onChange={e => setOverride(r.key, Number(e.target.value) / 100)}
                        className="w-16 accent-violet-500"
                      />
                      <span className={`text-xs ${r.isOverridden ? 'text-violet-300' : 'text-neutral-200'}`}>
                        {(r.effectiveProb * 100).toFixed(0)}%
                      </span>
                      {r.isOverridden && (
                        <button
                          onClick={() => resetOverride(r.key)}
                          className="text-[10px] text-neutral-500 hover:text-amber-300"
                          title="Reset to AI default"
                        >
                          ↺
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className={`text-neutral-200 ${r.isOverridden ? 'text-violet-300' : ''}`}>
                      {(r.effectiveProb * 100).toFixed(0)}%
                      {r.isOverridden && <span className="ml-1 text-[10px] text-violet-400">●</span>}
                    </span>
                  )}
                </td>
                {showRef && (
                  <>
                    <td className="px-2 py-2 text-right font-mono text-emerald-400/80">{fmtPct(r.upPct)}</td>
                    <td className="px-2 py-2 text-right font-mono text-red-400/80">{fmtPct(r.downPct)}</td>
                  </>
                )}
                <td className={`px-2 py-2 text-right font-mono ${r.expectedMovePct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {fmtPct(r.expectedMovePct, 1)}
                </td>
                <td className={`px-2 py-2 text-right font-mono ${r.expectedNpvImpactM >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  ${(r.expectedNpvImpactM / 1000).toFixed(2)}B
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aggregate && rows.length > 1 && (
        <div className="mt-4 rounded-md border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-200">
            <Activity className="h-3.5 w-3.5" />
            Multi-Catalyst Aggregate ({aggregate.n} catalysts){Object.keys(probOverrides).length > 0 && <span className="text-[10px] text-violet-400">· {Object.keys(probOverrides).length} weight{Object.keys(probOverrides).length>1?'s':''} adjusted</span>}
            <InfoTooltip
              text="If all catalysts play out at their probability-weighted expected moves, the cumulative effect on this stock. Capped at ±300%/-90% for sanity."
              position="top"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Combined expected" value={fmtPct(aggregate.totalExpectedPct, 1)} positive={aggregate.totalExpectedPct >= 0} />
            <Stat
              label="Combined NPV impact"
              value={`${aggregate.totalExpectedNpvImpactM >= 0 ? '+' : '-'}$${Math.abs(aggregate.totalExpectedNpvImpactM / 1000).toFixed(2)}B`}
              positive={aggregate.totalExpectedNpvImpactM >= 0}
            />
            <Stat label="If all approve" value={fmtPct(aggregate.upsideAllPct)} icon={<TrendingUp className="h-3 w-3" />} positive />
            <Stat label="If all reject" value={fmtPct(aggregate.downsideAllPct)} icon={<TrendingDown className="h-3 w-3" />} negative />
          </div>
          {primaryNpvB != null && (
            <div className="mt-2 text-[10px] text-neutral-500">
              Primary NPV (single catalyst): ${primaryNpvB.toFixed(2)}B · Multi-catalyst sum: ${(aggregate.totalExpectedNpvImpactM/1000).toFixed(2)}B
              {Math.abs(primaryNpvB - aggregate.totalExpectedNpvImpactM/1000) > 0.5 && (
                <span className="ml-1 text-amber-300">⚠ Significant divergence — anchor catalyst may not capture full pipeline value</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, positive, negative, icon }: { label: string; value: string; positive?: boolean; negative?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded border border-border/40 bg-bg/40 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
        {icon}{label}
      </div>
      <div className={`mt-0.5 text-sm font-mono ${positive ? 'text-emerald-200' : negative ? 'text-red-200' : 'text-neutral-100'}`}>{value}</div>
    </div>
  );
}
