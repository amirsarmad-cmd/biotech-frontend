'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  getStockDetail, getStockNews, getStockAnalyst, getStockSocial,
  getFundamentals, getHistory,
  type StockDetail,
} from '@/lib/api';
import { formatCurrency, formatMarketCap, formatDate, daysUntil, catalystColor, probColor } from '@/lib/utils';
import { NPVBreakdown } from '@/components/NPVBreakdown';
import { NewsPanel } from '@/components/NewsPanel';
import { AnalystPanel } from '@/components/AnalystPanel';
import { SocialPanel } from '@/components/SocialPanel';
import { RiskFactorsPanel } from '@/components/RiskFactorsPanel';
import { StockImpactPanel, ProbabilityMathPanel } from '@/components/ImpactAndProbability';
import { FundamentalsPanel } from '@/components/FundamentalsPanel';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';

type StockDetailExt = StockDetail & {
  npv_catalyst?: {
    type: string;
    date: string;
    probability: number;
    description: string;
  } | null;
};

type Period = '3mo' | '6mo' | '1y' | '2y';

export default function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const TICKER = ticker.toUpperCase();
  const [period, setPeriod] = useState<Period>('1y');

  const stockQ = useQuery({
    queryKey: ['stock', TICKER],
    queryFn: () => getStockDetail(TICKER, true) as Promise<StockDetailExt>,
    staleTime: 60_000,
  });

  const newsQ = useQuery({
    queryKey: ['news', TICKER],
    queryFn: () => getStockNews(TICKER, 25),
    staleTime: 5 * 60_000,
  });

  const analystQ = useQuery({
    queryKey: ['analyst', TICKER],
    queryFn: () => getStockAnalyst(TICKER),
    staleTime: 10 * 60_000,
  });

  const socialQ = useQuery({
    queryKey: ['social', TICKER],
    queryFn: () => getStockSocial(TICKER),
    staleTime: 10 * 60_000,
  });

  const fundQ = useQuery({
    queryKey: ['fund', TICKER],
    queryFn: () => getFundamentals(TICKER),
    staleTime: 10 * 60_000,
  });

  const histQ = useQuery({
    queryKey: ['hist', TICKER, period],
    queryFn: () => getHistory(TICKER, period),
    staleTime: 10 * 60_000,
  });

  const stock = stockQ.data;
  const npv = stock?.npv;

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-100">
        <ArrowLeft className="h-4 w-4" /> Back to screener
      </Link>

      {stockQ.isLoading && (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-panel" />
      )}

      {stockQ.error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-red-300">
          Error: {(stockQ.error as Error).message}
        </div>
      )}

      {stock && (
        <>
          {/* ───── HEADER ───── */}
          <div className="rounded-lg border border-border bg-panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-mono">{stock.ticker}</h1>
                  <span className="text-neutral-500">·</span>
                  <div className="text-xl text-neutral-300">{stock.company_name}</div>
                </div>
                <div className="mt-1 text-sm text-neutral-500">{stock.industry}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold tracking-tight">
                  {stock.current_price != null
                    ? formatCurrency(stock.current_price)
                    : <span className="text-neutral-500 text-base">No live price</span>}
                </div>
                <div className="text-sm text-neutral-400">Market cap {formatMarketCap(stock.market_cap_m)}</div>
              </div>
            </div>

            {/* Primary catalyst card */}
            <div className="mt-6 rounded-md border border-border bg-bg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Primary catalyst</div>
                  <div className={`mt-1 text-lg font-semibold ${catalystColor(stock.primary_catalyst.type)}`}>
                    {stock.primary_catalyst.type}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-neutral-400">{formatDate(stock.primary_catalyst.date)}</div>
                  {daysUntil(stock.primary_catalyst.date) != null && (
                    <div className="text-xs text-neutral-600">{daysUntil(stock.primary_catalyst.date)} days out</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Probability</div>
                  <div className={`mt-1 text-xl font-mono font-semibold ${probColor(stock.primary_catalyst.probability)}`}>
                    {(stock.primary_catalyst.probability * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm text-neutral-300">{stock.primary_catalyst.description}</div>
            </div>

            {/* All catalysts with NPV-anchor highlight */}
            {stock.all_catalysts.length > 1 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
                  All catalysts ({stock.all_catalysts.length})
                </div>
                <div className="space-y-2">
                  {stock.all_catalysts.slice(1).map((c, i) => {
                    const isNpvAnchor =
                      stock.npv_catalyst &&
                      stock.npv_catalyst.type === c.type &&
                      stock.npv_catalyst.date === c.date;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                          isNpvAnchor
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-border bg-bg/40'
                        }`}
                      >
                        <div>
                          <span className={catalystColor(c.type)}>{c.type}</span>
                          <span className="mx-2 text-neutral-600">·</span>
                          <span className="text-neutral-400">{formatDate(c.date)}</span>
                          {isNpvAnchor && (
                            <span className="ml-2 rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-300">
                              NPV anchor
                            </span>
                          )}
                        </div>
                        <div className={`font-mono ${probColor(c.probability)}`}>
                          {(c.probability * 100).toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ───── NPV: Section 1 (main cards) ───── */}
          <NPVBreakdown
            data={stock.npv}
            currentPrice={stock.current_price}
            npvCatalyst={stock.npv_catalyst}
          />

          {/* ───── Section 2: Stock Impact ───── */}
          {npv && !('status' in npv && npv.status === 'skipped') && !('error' in npv) && (
            <StockImpactPanel npv={npv} />
          )}

          {/* ───── Section 2B: Adverse Risk Factors ───── */}
          {npv && npv.risk_factor_breakdown && (
            <RiskFactorsPanel
              breakdown={npv.risk_factor_breakdown}
              totalDiscountPct={npv.risk_discount_pct}
              rawNpvB={npv.raw_drug_npv_m != null ? npv.raw_drug_npv_m / 1000 : undefined}
              adjustedNpvB={npv.drug_npv_m != null ? npv.drug_npv_m / 1000 : undefined}
            />
          )}

          {/* ───── Section 3: Probability Math ───── */}
          {npv && !('status' in npv && npv.status === 'skipped') && !('error' in npv) && (
            <ProbabilityMathPanel npv={npv} />
          )}

          {/* ───── Key + Extended Fundamentals ───── */}
          <FundamentalsPanel data={fundQ.data} loading={fundQ.isLoading} />

          {/* ───── Price History chart with catalyst markers ───── */}
          <PriceHistoryChart
            data={histQ.data}
            loading={histQ.isLoading}
            catalysts={stock.all_catalysts}
            period={period}
            onPeriodChange={setPeriod}
          />

          {/* ───── Analyst + Social side-by-side ───── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <AnalystPanel data={analystQ.data} loading={analystQ.isLoading} />
            <SocialPanel data={socialQ.data} loading={socialQ.isLoading} />
          </div>

          {/* ───── News ───── */}
          <NewsPanel data={newsQ.data} loading={newsQ.isLoading} />
        </>
      )}
    </div>
  );
}
