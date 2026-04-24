'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Fundamentals } from '@/lib/api';

function fmt$B(v: number) { return v ? `$${(v / 1e9).toFixed(2)}B` : 'N/A'; }
function fmt$M(v: number) { return v ? `$${(v / 1e6).toFixed(0)}M` : 'N/A'; }
function fmtNum(v: number) { return v ? v.toLocaleString() : 'N/A'; }
function fmtM(v: number) { return v ? `${(v / 1e6).toFixed(0)}M` : 'N/A'; }
function fmtPct(v: number) { return v ? `${(v * 100).toFixed(1)}%` : 'N/A'; }

export function FundamentalsPanel({ data, loading }: { data?: Fundamentals; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg border border-border bg-panel" />;
  }
  if (!data) return null;

  const { key, ownership, technicals, activity, financial_health, summary } = data;

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <h3 className="mb-4 text-lg">Key Fundamentals</h3>

      {/* 6 top metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricBlock label="Market Cap" value={fmt$B(key.market_cap)} />
        <MetricBlock label="Short %" value={fmtPct(key.short_pct_of_float)} />
        <MetricBlock label="P/E" value={key.pe_trailing ? key.pe_trailing.toFixed(1) : (key.pe_forward ? `${key.pe_forward.toFixed(1)}f` : 'N/A')} />
        <MetricBlock label="Cash" value={fmt$M(key.cash)} />
        <MetricBlock label="Revenue TTM" value={fmt$M(key.revenue_ttm)} />
        <MetricBlock label="Employees" value={fmtNum(key.employees)} />
      </div>

      {/* Expandable extended */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-4 flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Extended fundamentals
      </button>

      {expanded && (
        <div className="mt-4 space-y-5 border-t border-border pt-4">
          <SubSection title="Ownership & Structure">
            <MetricBlock label="Institutional" value={fmtPct(ownership.institutional_pct)} help="Higher = calmer post-event moves" />
            <MetricBlock label="Insider" value={fmtPct(ownership.insider_pct)} help="Heavy insider ownership can signal conviction" />
            <MetricBlock label="Float" value={fmtM(ownership.float_shares)} help="Shares available to trade publicly" />
            <MetricBlock label="Shares Out" value={fmtM(ownership.shares_outstanding)} />
          </SubSection>

          <SubSection title="Technicals & Position">
            <MetricBlock
              label="52W Position"
              value={technicals.week_52_position_pct != null ? `${technicals.week_52_position_pct.toFixed(0)}%` : 'N/A'}
              help={
                technicals.week_52_high && technicals.week_52_low
                  ? `$${technicals.week_52_low.toFixed(2)} – $${technicals.week_52_high.toFixed(2)}`
                  : undefined
              }
            />
            <MetricBlock label="Beta" value={technicals.beta != null ? technicals.beta.toFixed(2) : 'N/A'} help=">1 = more volatile than market" />
            <MetricBlock label="200d MA" value={technicals.ma_200 ? `$${technicals.ma_200.toFixed(2)}` : 'N/A'} />
            <MetricBlock label="50d MA" value={technicals.ma_50 ? `$${technicals.ma_50.toFixed(2)}` : 'N/A'} />
          </SubSection>

          <SubSection title="Trading Activity">
            <MetricBlock label="Avg Vol (3M)" value={activity.avg_volume_3m ? `${(activity.avg_volume_3m / 1e6).toFixed(1)}M` : 'N/A'} />
            <MetricBlock label="Avg Vol (10d)" value={activity.avg_volume_10d ? `${(activity.avg_volume_10d / 1e6).toFixed(1)}M` : 'N/A'} />
            <MetricBlock label="Short Ratio" value={activity.short_ratio != null ? `${activity.short_ratio.toFixed(1)}d` : 'N/A'} help="Days to cover; high = squeeze potential" />
            <MetricBlock label="Short % Float" value={fmtPct(activity.short_pct_float)} />
          </SubSection>

          <SubSection title="Financial Health">
            <MetricBlock label="Cash" value={fmt$M(financial_health.cash)} />
            <MetricBlock label="Debt" value={fmt$M(financial_health.debt)} />
            <MetricBlock label="TTM Revenue" value={fmt$M(financial_health.revenue_ttm)} />
            <MetricBlock
              label="Cash Runway"
              value={financial_health.runway_months != null ? `~${financial_health.runway_months.toFixed(0)}mo` : 'N/A'}
              help="Cash ÷ quarterly burn"
            />
          </SubSection>

          {summary && (
            <div className="rounded-md border border-border bg-bg/50 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Business overview</div>
              <p className="text-sm text-neutral-300 leading-relaxed">{summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
    </div>
  );
}

function MetricBlock({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="rounded-md border border-border bg-bg/40 p-3" title={help}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-neutral-100">{value}</div>
    </div>
  );
}
