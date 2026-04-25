'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  getStockDetail, getStockNews, getStockAnalyst, getStockSocial,
  getFundamentals, getHistory, getStrategies,
  type StockDetail, type NPVFull,
} from '@/lib/api';
import { formatCurrency, formatMarketCap, formatDate, daysUntil, catalystColor, probColor, formatPercent } from '@/lib/utils';
import { NPVBreakdown } from '@/components/NPVBreakdown';
import { NewsPanel } from '@/components/NewsPanel';
import { AnalystPanel } from '@/components/AnalystPanel';
import { SocialPanel } from '@/components/SocialPanel';
import { RiskFactorsPanel } from '@/components/RiskFactorsPanel';
import { StockImpactPanel, ProbabilityMathPanel } from '@/components/ImpactAndProbability';
import { FundamentalsPanel } from '@/components/FundamentalsPanel';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import { AIConsensusPanel } from '@/components/AIConsensusPanel';
import { StrategyPanel } from '@/components/StrategyPanel';
import { NewsImpactPanel } from '@/components/NewsImpactPanel';
import { WatchlistButton } from '@/components/WatchlistButton';
import { LoadingStatus, useQueryAction } from '@/components/LoadingStatus';
import { InvestmentCalculator } from '@/components/InvestmentCalculator';
import { CatalystTimeline } from '@/components/CatalystTimeline';

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
  const [period, setPeriod] = useState<Period>('2y');

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
  const stratQ = useQuery({
    queryKey: ['strategies', TICKER],
    queryFn: () => getStrategies(TICKER) as Promise<{ options_chain?: unknown }>,
    staleTime: 10 * 60_000,
  });

  // Loading status — exposes per-request progress to the UI
  const stockAction = useQueryAction({ key: 'stock', label: 'Stock detail + NPV', query: stockQ });
  const fundAction = useQueryAction({ key: 'fund', label: 'Fundamentals (cash, runway, debt)', query: fundQ });
  const histAction = useQueryAction({ key: 'hist', label: 'Price history', query: histQ });
  const newsAction = useQueryAction({ key: 'news', label: 'News articles', query: newsQ });
  const analystAction = useQueryAction({ key: 'analyst', label: 'Analyst ratings', query: analystQ });
  const socialAction = useQueryAction({ key: 'social', label: 'Social sentiment', query: socialQ });
  const stratAction = useQueryAction({ key: 'strat', label: 'Options chain + technicals', query: stratQ });

  const stock = stockQ.data;
  const npvRaw = stock?.npv;
  const npv: NPVFull | null = (npvRaw && typeof npvRaw === 'object' && !('status' in npvRaw) && !('error' in npvRaw))
    ? (npvRaw as NPVFull)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-100">
          <ArrowLeft className="h-4 w-4" /> Back to screener
        </Link>
        {stock && (
          <WatchlistButton
            ticker={TICKER}
            companyName={stock.company_name}
            currentPrice={stock.current_price}
            catalyst={stock.primary_catalyst}
            overallScore={stock.scores.overall}
          />
        )}
      </div>

      {/* Per-action loading status */}
      <LoadingStatus
        actions={[stockAction, fundAction, histAction, newsAction, analystAction, socialAction, stratAction]}
      />

      {stockQ.isLoading && <div className="h-64 animate-pulse rounded-lg border border-border bg-panel" />}
      {stockQ.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
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
                  {stock.current_price != null
                    ? formatCurrency(stock.current_price)
                    : <span className="text-neutral-500 text-base">No live price</span>}
                </div>
                <div className="text-sm text-neutral-400">Market cap {formatMarketCap(stock.market_cap_m)}</div>
                {npv?.baseline_price != null && (
                  <div className="mt-1 text-xs text-neutral-500">
                    baseline {formatCurrency(npv.baseline_price)} ({npv.baseline_days ?? 30}d ago)
                    {npv.implied_move_pct != null && (
                      <span className={` ml-1 ${npv.implied_move_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPercent(npv.implied_move_pct)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Top 3-col: catalyst / rating breakdown / big probability */}
            <div className="mt-6 grid gap-4 lg:grid-cols-[2fr,2fr,1fr]">
              {/* Catalyst details */}
              <div className="rounded-md border border-border bg-bg p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Primary catalyst</div>
                <div className={`mt-1 text-lg font-semibold ${catalystColor(stock.primary_catalyst.type)}`}>
                  {stock.primary_catalyst.type}
                </div>
                <div className="mt-2 text-sm text-neutral-400">
                  {formatDate(stock.primary_catalyst.date)}
                  {daysUntil(stock.primary_catalyst.date) != null && (
                    <span className="ml-2 text-xs text-neutral-500">
                      · {daysUntil(stock.primary_catalyst.date)}d out
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm text-neutral-300">{stock.primary_catalyst.description}</div>
              </div>

              <RatingBreakdown stock={stock} />

              {/* Big probability display */}
              <div className="rounded-md border border-border bg-bg p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Probability</div>
                <div className={`mt-2 text-5xl font-bold ${probColor(stock.primary_catalyst.probability)}`}>
                  {(stock.primary_catalyst.probability * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full ${
                      stock.primary_catalyst.probability >= 0.7 ? 'bg-emerald-500'
                      : stock.primary_catalyst.probability >= 0.5 ? 'bg-amber-500'
                      : 'bg-red-500'
                    }`}
                    style={{ width: `${stock.primary_catalyst.probability * 100}%` }}
                  />
                </div>
                {npv?.combined_prob != null && (
                  <div className="mt-3 text-xs">
                    <div className="text-neutral-500">Combined P(value)</div>
                    <div className="font-mono text-neutral-100">{(npv.combined_prob * 100).toFixed(0)}%</div>
                  </div>
                )}
              </div>
            </div>

            {/* All catalysts list */}
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

          {/* Section 1: NPV Breakdown */}
          <NPVBreakdown
            data={stock.npv}
            currentPrice={stock.current_price}
            npvCatalyst={stock.npv_catalyst}
          />

          {/* Section 2 + 3 side by side */}
          {npv && (
            <div className="grid gap-6 lg:grid-cols-2">
              <StockImpactPanel npv={npv} />
              <ProbabilityMathPanel npv={npv} />
            </div>
          )}

          {/* Catalyst Timeline (#7) — multi-catalyst NPV table */}
          {stock.all_catalysts && stock.all_catalysts.length > 0 && (
            <CatalystTimeline
              ticker={TICKER}
              catalysts={stock.all_catalysts}
              marketCapM={stock.market_cap_m}
              primaryNpvB={npv?.drug_npv_m ? npv.drug_npv_m / 1000 : null}
              primaryProbApproval={stock.npv_catalyst?.probability ?? stock.primary_catalyst.probability}
            />
          )}

          {/* Section 2B: Risk Factors */}
          {npv && npv.risk_factor_breakdown && (
            <RiskFactorsPanel
              breakdown={npv.risk_factor_breakdown}
              totalDiscountPct={npv.risk_discount_pct}
              rawNpvB={npv.raw_drug_npv_m != null ? npv.raw_drug_npv_m / 1000 : undefined}
              adjustedNpvB={npv.drug_npv_m != null ? npv.drug_npv_m / 1000 : undefined}
            />
          )}

          {/* Fundamentals */}
          <FundamentalsPanel data={fundQ.data} loading={fundQ.isLoading} />

          {/* Price chart */}
          <PriceHistoryChart
            data={histQ.data}
            loading={histQ.isLoading}
            catalysts={stock.all_catalysts}
            period={period}
            onPeriodChange={setPeriod}
          />

          {/* Analyst + Social */}
          <div className="grid gap-6 lg:grid-cols-2">
            <AnalystPanel data={analystQ.data} loading={analystQ.isLoading} />
            <SocialPanel data={socialQ.data} loading={socialQ.isLoading} />
          </div>

          {/* Trade Strategy */}
          <StrategyPanel
            ticker={TICKER}
            aiProb={stock.npv_catalyst?.probability ?? stock.primary_catalyst.probability}
            daysToCatalyst={(() => {
              const dt = new Date(stock.npv_catalyst?.date || stock.primary_catalyst.date);
              return Math.max(1, Math.round((dt.getTime() - Date.now()) / 86400000));
            })()}
          />

          {/* Investment Calculator (#8) */}
          <InvestmentCalculator
            ticker={TICKER}
            currentPrice={stock.current_price}
            probApproval={stock.npv_catalyst?.probability ?? stock.primary_catalyst.probability}
            upPct={npv?.upside_pct ?? null}
            downPct={npv?.downside_pct ?? null}
            optionsData={(stratQ.data as { options_chain?: { available?: boolean; expiry?: string | null; days_to_expiry?: number; calls?: Array<{ strike: number; bid: number; ask: number; lastPrice: number; impliedVolatility: number }>; puts?: Array<{ strike: number; bid: number; ask: number; lastPrice: number; impliedVolatility: number }>; atm_iv?: number } } | undefined)?.options_chain ?? null}
          />

          {/* AI 3-model consensus */}
          <AIConsensusPanel
            ticker={TICKER}
            companyName={stock.company_name}
            catalyst={stock.npv_catalyst || stock.primary_catalyst}
            npv={npv}
            news={newsQ.data?.articles}
          />

          {/* Section 2C: News × NPV impact */}
          {npv && stock.current_price && (
            <NewsImpactPanel
              ticker={TICKER}
              companyName={stock.company_name}
              currentPrice={stock.current_price}
              marketCapM={stock.market_cap_m}
              npv={npv}
              catalyst={stock.npv_catalyst || stock.primary_catalyst}
              news={newsQ.data?.articles}
            />
          )}

          {/* News */}
          <NewsPanel data={newsQ.data} loading={newsQ.isLoading} />
        </>
      )}
    </div>
  );
}

function RatingBreakdown({ stock }: { stock: StockDetailExt }) {
  const p = stock.primary_catalyst.probability;
  const news = Math.min((stock.scores.news_count || 0) / 20, 1);
  const cap = Math.min((stock.market_cap_m || 0) / 200000, 1);
  const days = daysUntil(stock.primary_catalyst.date);
  const prox = days != null && days >= 0 ? Math.max(0, 1 - days / 365) : 0;
  const sentAbs = stock.scores.sentiment != null ? Math.max(0, Math.min(1, (stock.scores.sentiment + 1) / 2)) : 0.5;

  const factors = [
    { label: '🎯 Catalyst probability', val: p, w: 0.35, reason: 'Approval likelihood' },
    { label: '📰 News sentiment', val: sentAbs, w: 0.15, reason: `Polarity: ${stock.scores.sentiment?.toFixed(2) ?? '—'}` },
    { label: '📊 News activity', val: news, w: 0.10, reason: `${stock.scores.news_count ?? 0} articles / 30d` },
    { label: '💰 Market cap', val: cap, w: 0.10, reason: `${formatMarketCap(stock.market_cap_m)} vs $200B` },
    { label: '⏳ Days proximity', val: prox, w: 0.30, reason: `${days ?? '—'} days to catalyst` },
  ];
  const total = factors.reduce((s, f) => s + f.val * f.w, 0);

  return (
    <div className="rounded-md border border-border bg-bg p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Rating breakdown</div>
      <div className="space-y-2">
        {factors.map((f) => {
          const pct = Math.round(f.val * 100);
          const color = f.val >= 0.7 ? 'bg-emerald-500' : f.val >= 0.4 ? 'bg-amber-500' : 'bg-red-500';
          return (
            <div key={f.label}>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300">{f.label}</span>
                <span className="font-mono text-neutral-500">
                  {pct}% × {(f.w * 100).toFixed(0)}% = {(f.val * f.w).toFixed(2)}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-0.5 text-[10px] text-neutral-600">{f.reason}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 border-t border-border pt-2 text-sm font-mono">
        Overall: <strong className="text-neutral-100">{total.toFixed(2)}</strong> / 1.00
      </div>
    </div>
  );
}
