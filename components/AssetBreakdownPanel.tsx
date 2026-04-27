'use client';

/**
 * AssetBreakdownPanel — per-program rNPV separation
 *
 * ChatGPT pass-4 critique #11: 'For platform companies like NTLA the cockpit
 * shows ONE rNPV based on the highest-materiality catalyst. But NTLA has
 * lonvo-z AND nex-z — two separate clinical assets each with their own
 * pipeline. Aggregating both into a single rNPV under-counts the company.'
 *
 * This panel groups all_catalysts by canonical_drug_name, picks the
 * highest-materiality catalyst per asset, fires N parallel /analyze/npv
 * requests, and shows a stacked breakdown:
 *
 *   Asset           rNPV/share   Catalyst       Date     P
 *   lonvo-z         $166.83      Phase 3 R/O    Apr 27   100%
 *   nex-z           $42.10       Clinical T     Jul 1    60%
 *   ─────────────────────────────────────────
 *   Total           $208.93                  vs $13.63 spot
 *
 * Lazy: only fires API calls when the panel is expanded. Cold-fires take
 * ~25-30s each, so we make them parallel and show a per-asset progress state.
 */

import React, { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { analyzeNpv, type Catalyst, type NPVAnalyzeResponse } from '@/lib/api';
import { Layers, ChevronDown } from 'lucide-react';

interface Props {
  ticker: string;
  marketCapM: number | null;
  currentPrice: number | null;
  catalysts: Catalyst[];
}

interface AssetGroup {
  canonicalDrugName: string;     // grouping key
  displayName: string;            // raw drug_name from highest-materiality catalyst
  primaryCatalyst: Catalyst;      // highest-materiality catalyst for this asset
  catalystCount: number;          // total catalysts for this asset
}

/** Group catalysts by canonical_drug_name, pick highest-materiality per group */
function groupAssets(catalysts: Catalyst[]): AssetGroup[] {
  const buckets = new Map<string, Catalyst[]>();
  for (const c of catalysts) {
    const key = (c.canonical_drug_name || c.drug_name || '').trim().toLowerCase();
    if (!key) continue;  // company-level catalysts (no drug) excluded — Earnings, etc.
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(c);
  }

  const out: AssetGroup[] = [];
  for (const [canonical, list] of buckets) {
    const sorted = [...list].sort(
      (a, b) => (b.materiality_score ?? 0) - (a.materiality_score ?? 0)
    );
    const primary = sorted[0];
    out.push({
      canonicalDrugName: canonical,
      displayName: primary.drug_name ?? canonical,
      primaryCatalyst: primary,
      catalystCount: list.length,
    });
  }

  // Sort assets by primary catalyst materiality, descending
  return out.sort(
    (a, b) =>
      (b.primaryCatalyst.materiality_score ?? 0) -
      (a.primaryCatalyst.materiality_score ?? 0)
  );
}

export default function AssetBreakdownPanel({ ticker, marketCapM, currentPrice, catalysts }: Props) {
  const [expanded, setExpanded] = useState(false);

  const assets = useMemo(() => groupAssets(catalysts), [catalysts]);

  // Only fire NPV requests when panel is expanded — cold each takes 25-30s
  // and we don't want to block initial page load.
  const npvQueries = useQueries({
    queries: assets.map((a) => ({
      queryKey: ['asset-npv', ticker, a.canonicalDrugName, a.primaryCatalyst.type, a.primaryCatalyst.date],
      enabled: expanded,
      staleTime: 30 * 60_000,
      retry: 1,
      queryFn: async (): Promise<NPVAnalyzeResponse> => {
        return analyzeNpv({
          ticker,
          catalyst_type: a.primaryCatalyst.type,
          market_cap_m: marketCapM ?? 0,
          p_approval: a.primaryCatalyst.probability,
          drug_name_override: a.primaryCatalyst.drug_name ?? a.displayName,
          description_override: a.primaryCatalyst.description,
        });
      },
    })),
  });

  // If only 1 asset, panel adds no info — hide it
  if (assets.length < 2) return null;

  // Aggregate per-share contributions for the stacked total.
  // Field path: response.rnpv.per_share_drug_npv_usd (basic) — this is the
  // per-share asset value at the user's p_approval. We could also read
  // rnpv.per_share_after_dilution_usd if dilution_assumed_pct was passed.
  // Note: response.economics_v2 has confidence/breakdown but NOT per-share
  // valuation — that lives on response.rnpv.
  const perShareValues: Array<{ asset: AssetGroup; perShare: number | null; rnpvM: number | null; loading: boolean; error: boolean }> = assets.map((a, i) => {
    const q = npvQueries[i];
    const rnpv = q.data?.rnpv;
    const ps = rnpv?.per_share_after_dilution_usd ?? rnpv?.per_share_drug_npv_usd ?? null;
    const rm = rnpv?.rnpv_m ?? null;
    return {
      asset: a,
      perShare: typeof ps === 'number' ? ps : null,
      rnpvM: typeof rm === 'number' ? rm : null,
      loading: q.isLoading || q.isFetching,
      error: q.isError,
    };
  });

  const totalPerShare = perShareValues
    .map((x) => x.perShare ?? 0)
    .reduce((a, b) => a + b, 0);
  const allLoaded = perShareValues.every((x) => !x.loading && !x.error);

  return (
    <details
      className="rounded-lg border border-border/50 bg-bg/40"
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm text-neutral-300 hover:text-neutral-100 select-none flex items-center gap-2">
        <Layers className="h-4 w-4 text-violet-400" />
        <span className="font-medium">
          Multi-asset breakdown ({assets.length} programs)
        </span>
        <span className="text-[10px] text-neutral-500">
          — values each program separately, sums to platform fair value
        </span>
        <ChevronDown className="ml-auto h-4 w-4 transition-transform" />
      </summary>

      <div className="border-t border-border/40 p-4 space-y-3">
        <p className="text-xs text-neutral-500 leading-snug">
          {ticker} has multiple distinct clinical programs. The headline rNPV in the cockpit values only the
          highest-materiality catalyst. This panel computes rNPV for each program separately and sums them
          for a platform-level fair value. <span className="text-amber-300/80">
            Cold-loads take 25-30s per asset; results cached 30min.
          </span>
        </p>

        {/* Per-asset rows */}
        <div className="space-y-2">
          {perShareValues.map(({ asset, perShare, rnpvM, loading, error }) => {
            const cat = asset.primaryCatalyst;
            const ratio = totalPerShare > 0 && perShare ? (perShare / totalPerShare) * 100 : 0;
            return (
              <div key={asset.canonicalDrugName} className="rounded border border-border bg-bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-neutral-200 truncate">
                      {asset.displayName}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {cat.type} · {cat.date} · P={(cat.probability * 100).toFixed(0)}%
                      {asset.catalystCount > 1 && (
                        <span> · {asset.catalystCount} catalysts</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {loading && (
                      <span className="text-[10px] text-neutral-500 animate-pulse">computing…</span>
                    )}
                    {error && (
                      <span className="text-[10px] text-red-400">error</span>
                    )}
                    {!loading && !error && perShare != null && (
                      <>
                        <div className="font-mono text-emerald-300 text-sm">
                          ${perShare.toFixed(2)}
                          <span className="text-[9px] text-neutral-500 ml-1">/share</span>
                        </div>
                        {rnpvM != null && rnpvM > 0 && (
                          <div className="text-[9px] text-neutral-500 font-mono">
                            rNPV ${(rnpvM / 1000).toFixed(2)}B
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* Stacked-bar contribution */}
                {!loading && !error && perShare != null && perShare > 0 && (
                  <div className="mt-2 h-1 rounded-full bg-neutral-800/60 overflow-hidden">
                    <div
                      className="h-full bg-violet-400/70"
                      style={{ width: `${Math.min(100, ratio)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total */}
        {allLoaded && totalPerShare > 0 && (
          <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3 mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-neutral-300">Sum of programs (per-share)</span>
              <span className="font-mono text-violet-300 text-base">
                ${totalPerShare.toFixed(2)}
              </span>
            </div>
            {currentPrice && (
              <div className="text-[10px] text-neutral-500 mt-1">
                vs <span className="font-mono text-neutral-300">${currentPrice.toFixed(2)}</span> spot
                {' · '}
                <span className={totalPerShare > currentPrice ? 'text-emerald-400' : 'text-red-400'}>
                  {totalPerShare > currentPrice ? '+' : ''}
                  {(((totalPerShare - currentPrice) / currentPrice) * 100).toFixed(0)}%
                </span>
              </div>
            )}
            <div className="text-[9px] text-neutral-500 mt-2 leading-snug">
              <strong>Caveat:</strong> Summing per-asset rNPVs assumes programs are independent. In reality,
              shared overhead, dilution risk, and correlated platform risk mean the true platform value is
              typically lower than the simple sum. Use this as an upper bound, not a point estimate.
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
