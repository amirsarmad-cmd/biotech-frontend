'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { InfoTooltip } from './tooltips';

interface Props {
  catalystId: number | null | undefined;
  drugName?: string | null;
  enabled?: boolean;
}

interface RiskResult {
  cached: boolean;
  age_hours?: number;
  catalyst_id: number;
  ticker: string;
  drug_name?: string | null;
  indication?: string | null;
  factors: Record<string, number | string | null>;
  total_discount: number;
  context_used?: string;
  last_updated?: string;
}

const FACTOR_LABELS: Record<string, string> = {
  litigation: 'Litigation',
  fda_history: 'FDA history (CRLs, withdrawals)',
  sec_short: 'SEC / short-seller reports',
  insider_sell: 'Insider selling',
  going_concern: 'Cash runway / going concern',
  patent_cliff: 'Patent cliff',
  governance: 'Governance / turnover',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://biotech-api-production-7ec4.up.railway.app';

async function fetchRisks(catalystId: number, refresh = false): Promise<RiskResult> {
  const url = `${API_BASE}/v2/catalysts/${catalystId}/risk-factors${refresh ? '?refresh=true' : ''}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

export function CatalystRiskPanel({ catalystId, drugName, enabled = true }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  const q = useQuery({
    queryKey: ['catalyst-risks', catalystId, refreshKey],
    queryFn: () => fetchRisks(catalystId!, refreshKey > 0),
    enabled: enabled && !!catalystId,
    staleTime: 60 * 60 * 1000,  // 1h
  });

  if (!catalystId) {
    return null;
  }

  const helpText = "Drug-specific adverse risk factors. Reads context like drug name, indication, phase, prior CRL history. Each factor returns a 0-30% discount that compounds against the drug NPV. Cached 24h, recheck on news.";

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          Drug-Specific Risk Factors
          <InfoTooltip text={helpText} position="bottom" />
          {q.data?.cached && (
            <span className="ml-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300">
              cached · {q.data.age_hours?.toFixed(1)}h ago
            </span>
          )}
          {q.data && !q.data.cached && (
            <span className="ml-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              fresh
            </span>
          )}
        </h3>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={q.isFetching}
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-amber-300 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${q.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {drugName && <div className="mb-3 text-xs text-neutral-400">For: <span className="text-violet-300">{drugName}</span></div>}

      {q.isLoading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Computing risks…
        </div>
      )}

      {q.error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="inline h-4 w-4 mr-1" />
          {(q.error as Error).message}
        </div>
      )}

      {q.data && (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-200">Total discount applied to NPV</span>
              <span className="font-mono text-lg text-amber-200">
                {(q.data.total_discount * 100).toFixed(1)}%
              </span>
            </div>
            {q.data.total_discount === 0 && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> No material risks identified
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {Object.keys(FACTOR_LABELS).map(key => {
              const value = Number(q.data.factors?.[key] ?? 0);
              const rationale = String(q.data.factors?.[`${key}_rationale`] ?? '');
              const sev = value >= 0.15 ? 'high' : value >= 0.05 ? 'med' : 'low';
              const color = sev === 'high' ? 'text-red-300' : sev === 'med' ? 'text-amber-300' : 'text-neutral-500';
              const bg = sev === 'high' ? 'bg-red-500/5 border-red-500/20' : sev === 'med' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-bg/40 border-border/30';
              return (
                <div key={key} className={`rounded border ${bg} px-3 py-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-300">{FACTOR_LABELS[key]}</span>
                    <span className={`font-mono text-xs ${color}`}>{(value * 100).toFixed(1)}%</span>
                  </div>
                  {rationale && (
                    <div className="mt-1 text-[11px] text-neutral-500 leading-relaxed">{rationale}</div>
                  )}
                </div>
              );
            })}
          </div>

          {q.data.context_used && (
            <details className="text-[10px] text-neutral-600">
              <summary className="cursor-pointer hover:text-neutral-400">Context used by AI</summary>
              <pre className="mt-1 whitespace-pre-wrap rounded border border-border/30 bg-bg/40 p-2">{q.data.context_used}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
