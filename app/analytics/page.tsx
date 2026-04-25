'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TrendingUp, Calendar, Activity, BarChart3 } from 'lucide-react';
import { listStocks } from '@/lib/api';
import { catalystColor, probColor, formatMarketCap, daysUntil } from '@/lib/utils';

export default function AnalyticsPage() {
  const q = useQuery({
    queryKey: ['stocks-all'],
    queryFn: () => listStocks({ limit: 1000, sort: 'overall_score' }),
    staleTime: 5 * 60_000,
  });

  if (q.isLoading) {
    return <div className="h-64 animate-pulse rounded-lg border border-border bg-panel" />;
  }
  if (q.error || !q.data) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {(q.error as Error)?.message || 'No data'}
      </div>
    );
  }

  const stocks = q.data.stocks;

  // Top 10 by overall score
  const top10 = [...stocks].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0)).slice(0, 10);

  // Top 10 highest-probability
  const topProb = [...stocks]
    .filter((s) => (s.probability || 0) >= 0.7)
    .sort((a, b) => (b.probability || 0) - (a.probability || 0))
    .slice(0, 10);

  // Imminent (within 14 days)
  const imminent = stocks
    .filter((s) => {
      const d = daysUntil(s.catalyst_date);
      return d != null && d >= 0 && d <= 14;
    })
    .sort((a, b) => (daysUntil(a.catalyst_date) || 0) - (daysUntil(b.catalyst_date) || 0));

  // Catalyst type distribution
  const catalystCounts: Record<string, number> = {};
  stocks.forEach((s) => {
    if (s.catalyst_type) catalystCounts[s.catalyst_type] = (catalystCounts[s.catalyst_type] || 0) + 1;
  });
  const catalystSorted = Object.entries(catalystCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCatalystCount = Math.max(...catalystSorted.map(([_, n]) => n), 1);

  // Industry breakdown
  const industries: Record<string, number> = {};
  stocks.forEach((s) => {
    const ind = s.industry || 'Unknown';
    industries[ind] = (industries[ind] || 0) + 1;
  });
  const industriesSorted = Object.entries(industries).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Avg / Sum stats
  const avgProb = stocks.reduce((s, x) => s + (x.probability || 0), 0) / stocks.length;
  const totalMcap = stocks.reduce((s, x) => s + (x.market_cap || 0), 0) / 1000; // $B

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2"><BarChart3 className="h-6 w-6 text-emerald-400" /> Analytics</h1>
        <p className="text-sm text-neutral-500 mt-1">Universe-wide insights across {q.data.universe_size} catalysts</p>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total catalysts" value={q.data.universe_size} />
        <Stat label="High probability" value={q.data.high_prob_count} suffix={`/ ${q.data.universe_size}`} accent="emerald" />
        <Stat label="Avg probability" value={`${(avgProb * 100).toFixed(0)}%`} />
        <Stat label="Total market cap" value={`$${(totalMcap / 1000).toFixed(1)}T`} />
      </div>

      {/* Imminent catalysts */}
      <Section title="Imminent catalysts (next 14 days)" icon={<Calendar className="h-5 w-5 text-amber-400" />}>
        {imminent.length === 0 ? (
          <p className="text-sm text-neutral-500">No catalysts in the next 14 days.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bg/50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Ticker</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-left">Catalyst</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Days</th>
                  <th className="px-3 py-2 text-right">Prob</th>
                </tr>
              </thead>
              <tbody>
                {imminent.slice(0, 12).map((s) => (
                  <tr key={`${s.ticker}-${s.catalyst_date}`} className="border-t border-border hover:bg-bg/30">
                    <td className="px-3 py-2">
                      <Link href={`/stocks/${s.ticker}`} className="font-mono font-semibold text-neutral-100 hover:text-accent">
                        {s.ticker}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-neutral-300">{s.company_name?.slice(0, 32) || '—'}</td>
                    <td className="px-3 py-2"><span className={catalystColor(s.catalyst_type)}>{s.catalyst_type}</span></td>
                    <td className="px-3 py-2 text-neutral-400">{s.catalyst_date}</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-300">{daysUntil(s.catalyst_date)}d</td>
                    <td className={`px-3 py-2 text-right font-mono ${probColor(s.probability)}`}>{(s.probability * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Top performers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top by overall score" icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}>
          <ol className="space-y-1 text-sm">
            {top10.map((s, i) => (
              <li key={`${s.ticker}-${s.catalyst_date}`} className="flex items-center gap-2 rounded-md border border-border bg-bg/40 px-3 py-2">
                <span className="w-6 text-right text-xs text-neutral-500">#{i + 1}</span>
                <Link href={`/stocks/${s.ticker}`} className="font-mono font-semibold text-neutral-100 hover:text-accent w-16">
                  {s.ticker}
                </Link>
                <span className="text-neutral-400 truncate flex-1">{s.company_name}</span>
                <span className="font-mono text-emerald-400">{s.overall_score.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Highest probability (≥70%)" icon={<Activity className="h-5 w-5 text-blue-400" />}>
          {topProb.length === 0 ? (
            <p className="text-sm text-neutral-500">No catalysts with probability ≥70%.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {topProb.map((s, i) => (
                <li key={`${s.ticker}-${s.catalyst_date}`} className="flex items-center gap-2 rounded-md border border-border bg-bg/40 px-3 py-2">
                  <span className="w-6 text-right text-xs text-neutral-500">#{i + 1}</span>
                  <Link href={`/stocks/${s.ticker}`} className="font-mono font-semibold text-neutral-100 hover:text-accent w-16">
                    {s.ticker}
                  </Link>
                  <span className="text-neutral-500 truncate flex-1 text-xs">{s.catalyst_type}</span>
                  <span className={`font-mono ${probColor(s.probability)}`}>{(s.probability * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      {/* Distributions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Catalyst type distribution" icon={null}>
          <div className="space-y-2">
            {catalystSorted.map(([type, count]) => (
              <div key={type}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={catalystColor(type)}>{type}</span>
                  <span className="font-mono text-neutral-500">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="h-full bg-emerald-500/60" style={{ width: `${(count / maxCatalystCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Industry breakdown" icon={null}>
          <ul className="space-y-1 text-sm">
            {industriesSorted.map(([ind, count]) => (
              <li key={ind} className="flex justify-between rounded-md border border-border bg-bg/40 px-3 py-2">
                <span className="text-neutral-300 truncate">{ind}</span>
                <span className="font-mono text-neutral-500">{count}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix, accent = 'neutral' }: { label: string; value: string | number; suffix?: string; accent?: 'emerald' | 'neutral' }) {
  const cls = accent === 'emerald' ? 'text-emerald-400' : 'text-neutral-100';
  return (
    <div className="rounded-md border border-border bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${cls}`}>
        {value}{suffix && <span className="text-sm text-neutral-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg">{icon} {title}</h2>
      {children}
    </div>
  );
}
