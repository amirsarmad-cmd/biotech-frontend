'use client';

import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { formatCurrency, formatPercent, probColor } from '@/lib/utils';
import type { StockDetail } from '@/lib/api';

export function NPVBreakdown({
  data,
  currentPrice,
}: {
  data: StockDetail['npv'];
  currentPrice: number | null;
}) {
  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-2">NPV Analysis</h2>
        <p className="text-sm text-neutral-500">Not available for this catalyst.</p>
      </div>
    );
  }

  // API returns either { economics, npv: {...} } or the breakdown directly
  const economics = (data as { economics?: unknown }).economics as Record<string, unknown> | undefined;
  const npv = ((data as { npv?: unknown }).npv || data) as Record<string, unknown>;

  if ((data as { error?: string }).error) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-6">
        <h2 className="mb-2 text-amber-200">NPV Analysis unavailable</h2>
        <p className="text-sm text-amber-400/80">{(data as { error: string }).error}</p>
      </div>
    );
  }

  const expected = npv.expected as number | undefined;
  const approval = npv.approval as number | undefined;
  const rejection = npv.rejection as number | undefined;
  const expectedPct = npv.expected_pct as number | undefined;
  const upsidePct = npv.upside_pct as number | undefined;
  const downsidePct = npv.downside_pct as number | undefined;
  const combinedProb = npv.combined_prob as number | undefined;
  const drugNpvM = npv.drug_npv_m as number | undefined;
  const peakSalesB = (npv.peak_sales_b as number | undefined) ?? (economics?.peak_sales_usd_b as number | undefined);
  const multiple = (npv.multiple as number | undefined) ?? (economics?.multiple as number | undefined);
  const peakSalesRationale = (npv.peak_sales_rationale as string | undefined) ?? (economics?.peak_sales_rationale as string | undefined);
  const multipleRationale = (npv.multiple_rationale as string | undefined) ?? (economics?.multiple_rationale as string | undefined);
  const commercialRationale = (npv.commercial_rationale as string | undefined) ?? (economics?.commercial_success_rationale as string | undefined);
  const riskDiscount = npv.risk_discount_pct as number | undefined;

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2>NPV Analysis</h2>
        {economics?._llm_provider != null && (
          <div className="text-xs text-neutral-500">via {String(economics._llm_provider)}</div>
        )}
      </div>

      {/* 3-way price cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PriceCard
          label="Expected"
          price={expected}
          pct={expectedPct}
          accent="neutral"
          sub={combinedProb != null ? `p=${(combinedProb * 100).toFixed(0)}%` : ''}
        />
        <PriceCard
          label="Approval"
          price={approval}
          pct={upsidePct}
          accent="bull"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <PriceCard
          label="Rejection"
          price={rejection}
          pct={downsidePct}
          accent="bear"
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      {/* Breakdown */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-bg/50 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Peak sales</div>
          <div className="mt-1 text-lg font-semibold">
            {peakSalesB != null ? `$${Number(peakSalesB).toFixed(1)}B` : '—'}
          </div>
          {peakSalesRationale && (
            <p className="mt-2 text-xs text-neutral-400 leading-relaxed">{peakSalesRationale}</p>
          )}
        </div>
        <div className="rounded-md border border-border bg-bg/50 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Multiple × Commercial prob</div>
          <div className="mt-1 text-lg font-semibold">
            {multiple != null ? `${Number(multiple).toFixed(1)}×` : '—'}
            {drugNpvM != null && <span className="ml-2 text-sm text-neutral-400">= ${(drugNpvM / 1000).toFixed(2)}B NPV</span>}
          </div>
          {multipleRationale && (
            <p className="mt-2 text-xs text-neutral-400 leading-relaxed">{multipleRationale}</p>
          )}
        </div>
      </div>

      {/* Commercial rationale */}
      {commercialRationale && (
        <div className="mt-4 rounded-md border border-border bg-bg/50 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500">Commercial success rationale</div>
              <p className="mt-1 text-sm text-neutral-300 leading-relaxed">{commercialRationale}</p>
            </div>
          </div>
        </div>
      )}

      {/* Risk discount */}
      {riskDiscount != null && riskDiscount > 0 && (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
          <span className="text-amber-400 font-medium">Risk discount applied: </span>
          <span className="text-amber-200">{(riskDiscount * 100).toFixed(0)}%</span>
          <span className="ml-2 text-xs text-amber-400/60">(adverse factors reduce drug NPV)</span>
        </div>
      )}
    </div>
  );
}

function PriceCard({
  label,
  price,
  pct,
  accent,
  sub,
  icon,
}: {
  label: string;
  price: number | undefined;
  pct: number | undefined;
  accent: 'bull' | 'bear' | 'neutral';
  sub?: string;
  icon?: React.ReactNode;
}) {
  const color =
    accent === 'bull' ? 'text-emerald-400'
    : accent === 'bear' ? 'text-red-400'
    : 'text-neutral-200';
  const border =
    accent === 'bull' ? 'border-emerald-500/20'
    : accent === 'bear' ? 'border-red-500/20'
    : 'border-border';
  return (
    <div className={`rounded-md border ${border} bg-bg/50 p-4`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
        {icon} {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>
        {price != null ? formatCurrency(price) : '—'}
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className={color}>{pct != null ? formatPercent(pct) : ''}</span>
        {sub && <span className="text-xs text-neutral-500">{sub}</span>}
      </div>
    </div>
  );
}
