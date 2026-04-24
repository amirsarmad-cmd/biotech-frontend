'use client';

import type { AnalystData } from '@/lib/api';

export function AnalystPanel({ data, loading }: { data?: AnalystData; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-3">Analyst Consensus</h2>
        <div className="h-28 animate-pulse rounded-md border border-border bg-bg/50" />
      </div>
    );
  }

  const d = (data?.data ?? {}) as Record<string, unknown>;
  const hasData = data?.data && Object.keys(d).length > 0;

  // Normalize common field names the backend returns
  const rating =
    (d.consensus as string | undefined)
    ?? (d.recommendation as string | undefined)
    ?? (d.rating as string | undefined);
  const priceTarget =
    (d.price_target as number | undefined)
    ?? (d.target_mean_price as number | undefined)
    ?? (d.price_target_mean as number | undefined);
  const priceTargetHigh = (d.price_target_high as number | undefined) ?? (d.target_high_price as number | undefined);
  const priceTargetLow = (d.price_target_low as number | undefined) ?? (d.target_low_price as number | undefined);
  const analystCount =
    (d.num_analysts as number | undefined)
    ?? (d.number_of_analysts as number | undefined)
    ?? (d.analyst_count as number | undefined);

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2>Analyst Consensus</h2>
        {data?.error && <span className="text-xs text-red-400">error</span>}
      </div>

      {!hasData || data?.error ? (
        <p className="text-sm text-neutral-500">
          {data?.error ? data.error.slice(0, 120) : 'No analyst data available.'}
        </p>
      ) : (
        <div className="space-y-4">
          {rating && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-neutral-500">Recommendation</span>
              <span className="text-lg font-semibold text-neutral-100">{rating}</span>
            </div>
          )}
          {priceTarget != null && (
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-neutral-500">Price target (mean)</span>
                <span className="text-lg font-semibold text-emerald-400">${Number(priceTarget).toFixed(2)}</span>
              </div>
              {(priceTargetLow != null || priceTargetHigh != null) && (
                <div className="mt-1 text-xs text-neutral-500">
                  Range: ${priceTargetLow?.toFixed(2) ?? '—'} - ${priceTargetHigh?.toFixed(2) ?? '—'}
                </div>
              )}
            </div>
          )}
          {analystCount != null && (
            <div className="text-xs text-neutral-500">Based on {analystCount} analyst(s)</div>
          )}
          {/* Raw dump for fields we didn't normalize */}
          {Object.keys(d).length > 0 && !rating && priceTarget == null && (
            <pre className="max-h-48 overflow-auto text-xs text-neutral-400 font-mono">
              {JSON.stringify(d, null, 2).slice(0, 1000)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
