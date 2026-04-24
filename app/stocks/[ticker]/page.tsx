'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getStockDetail, getStockNews, getStockAnalyst, getStockSocial } from '@/lib/api';
import { formatCurrency, formatPercent, formatMarketCap, formatDate, daysUntil, catalystColor, probColor, stripTags } from '@/lib/utils';
import { NPVBreakdown } from '@/components/NPVBreakdown';
import { NewsPanel } from '@/components/NewsPanel';
import { AnalystPanel } from '@/components/AnalystPanel';
import { SocialPanel } from '@/components/SocialPanel';

export default function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const TICKER = ticker.toUpperCase();

  const stockQ = useQuery({
    queryKey: ['stock', TICKER],
    queryFn: () => getStockDetail(TICKER, true),
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

  const stock = stockQ.data;

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
          {/* Header */}
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
                  {stock.current_price != null ? formatCurrency(stock.current_price) : <span className="text-neutral-500 text-base">No live price</span>}
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

            {/* All catalysts */}
            {stock.all_catalysts.length > 1 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">All catalysts ({stock.all_catalysts.length})</div>
                <div className="space-y-2">
                  {stock.all_catalysts.slice(1).map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border bg-bg/40 px-3 py-2 text-sm">
                      <div>
                        <span className={catalystColor(c.type)}>{c.type}</span>
                        <span className="mx-2 text-neutral-600">·</span>
                        <span className="text-neutral-400">{formatDate(c.date)}</span>
                      </div>
                      <div className={`font-mono ${probColor(c.probability)}`}>{(c.probability * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* NPV Breakdown */}
          <NPVBreakdown data={stock.npv} currentPrice={stock.current_price} />

          {/* Two-column: Analyst + Social */}
          <div className="grid gap-6 lg:grid-cols-2">
            <AnalystPanel data={analystQ.data} loading={analystQ.isLoading} />
            <SocialPanel data={socialQ.data} loading={socialQ.isLoading} />
          </div>

          {/* News */}
          <NewsPanel data={newsQ.data} loading={newsQ.isLoading} />
        </>
      )}
    </div>
  );
}
