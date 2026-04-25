'use client';

import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { InfoTooltip } from './tooltips';
import { HELP } from '@/lib/help-text';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface NPVProps {
  data: unknown;
  currentPrice: number | null;
  npvCatalyst?: {
    type: string;
    date: string;
    probability: number;
    description: string;
  } | null;
}

export function NPVBreakdown({ data, currentPrice, npvCatalyst }: NPVProps) {
  // Handle skipped state
  if (data && typeof data === 'object' && 'status' in data && ((data as unknown) as { status?: string }).status === 'skipped') {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-2">NPV Analysis <InfoTooltip text={HELP.stockDetail.npv_analysis} position="bottom" /></h2>
        <div className="rounded-md border border-neutral-700 bg-bg/50 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
            <div className="text-sm text-neutral-400">
              {((data as unknown) as { reason?: string }).reason}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || typeof data !== 'object') {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-2">NPV Analysis <InfoTooltip text={HELP.stockDetail.npv_analysis} position="bottom" /></h2>
        <p className="text-sm text-neutral-500">Not available for this catalyst.</p>
      </div>
    );
  }

  const npvObj = data as Record<string, unknown>;

  // Error case
  if ('error' in npvObj && typeof npvObj.error === 'string') {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-6">
        <h2 className="mb-2 text-amber-200">NPV Analysis unavailable</h2>
        <p className="text-sm text-amber-400/80">{npvObj.error}</p>
      </div>
    );
  }

  // Extract fields (the route folds economics into _economics)
  const economics = (npvObj._economics as Record<string, unknown>) || {};

  const expected = npvObj.expected as number | undefined;
  const approval = npvObj.approval as number | undefined;
  const rejection = npvObj.rejection as number | undefined;
  const expectedPct = npvObj.expected_pct as number | undefined;
  const upsidePct = npvObj.upside_pct as number | undefined;
  const downsidePct = npvObj.downside_pct as number | undefined;
  const combinedProb = npvObj.combined_prob as number | undefined;
  const drugNpvM = npvObj.drug_npv_m as number | undefined;
  const peakSalesB = (npvObj.peak_sales_b as number | undefined) ?? (economics.peak_sales_usd_b as number | undefined);
  const multiple = (npvObj.multiple as number | undefined) ?? (economics.multiple as number | undefined);
  const peakSalesRationale = (npvObj.peak_sales_rationale as string | undefined) ?? (economics.peak_sales_rationale as string | undefined);
  const multipleRationale = (npvObj.multiple_rationale as string | undefined) ?? (economics.multiple_rationale as string | undefined);
  const commercialRationale = (npvObj.commercial_rationale as string | undefined) ?? (economics.commercial_success_rationale as string | undefined);
  const riskDiscount = npvObj.risk_discount_pct as number | undefined;
  const llmProvider = economics._llm_provider as string | undefined;

  // If all key fields are zero/null, show a placeholder
  const looksEmpty =
    (!expected || expected === 0) &&
    (!approval || approval === 0) &&
    (!rejection || rejection === 0) &&
    (!peakSalesB || peakSalesB === 0);

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2>NPV Analysis <InfoTooltip text={HELP.stockDetail.npv_analysis} position="bottom" /></h2>
          {npvCatalyst && (
            <div className="mt-1 text-xs text-neutral-500">
              based on <span className="text-emerald-400">{npvCatalyst.type}</span>
              {' · '}{npvCatalyst.date}
              {' · '}p={((npvCatalyst.probability || 0) * 100).toFixed(0)}%
            </div>
          )}
        </div>
        {llmProvider && <div className="text-xs text-neutral-500">via {llmProvider}</div>}
      </div>

      {looksEmpty && (
        <div className="rounded-md border border-neutral-700 bg-bg/50 p-4 text-sm text-neutral-400">
          The LLM returned no drug economics for this catalyst. This usually means the description doesn't
          identify a specific approval decision. Try the direct <code className="text-neutral-200">/analyze/npv</code>{' '}
          endpoint with custom inputs.
        </div>
      )}

      {!looksEmpty && (
        <>
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
              <div className="text-xs uppercase tracking-wide text-neutral-500">Multiple · NPV</div>
              <div className="mt-1 text-lg font-semibold">
                {multiple != null ? `${Number(multiple).toFixed(1)}×` : '—'}
                {drugNpvM != null && drugNpvM > 0 && (
                  <span className="ml-2 text-sm text-neutral-400">= ${(drugNpvM / 1000).toFixed(2)}B</span>
                )}
              </div>
              {multipleRationale && (
                <p className="mt-2 text-xs text-neutral-400 leading-relaxed">{multipleRationale}</p>
              )}
            </div>
          </div>

          {commercialRationale && (
            <div className="mt-4 rounded-md border border-border bg-bg/50 p-4">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Commercial rationale</div>
                  <p className="mt-1 text-sm text-neutral-300 leading-relaxed">{commercialRationale}</p>
                </div>
              </div>
            </div>
          )}

          {riskDiscount != null && riskDiscount > 0 && (
            <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
              <span className="text-amber-400 font-medium">Risk discount applied: </span>
              <span className="text-amber-200">{riskDiscount.toFixed(1)}%</span>
              <span className="ml-2 text-xs text-amber-400/60">
                (adverse factors reduce drug NPV)
              </span>
            </div>
          )}
        </>
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
