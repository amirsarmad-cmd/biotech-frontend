'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Coins, AlertTriangle, Plus, Trash2, RefreshCw, ShieldAlert, ShieldCheck, Edit3 } from 'lucide-react';
import {
  getLlmUsageHeadline, getLlmUsageSummary, getLlmRecentUsage,
  getLlmBudgets, setLlmBudget, deleteLlmBudget,
  type LlmBudget,
} from '@/lib/api';
import { InfoTooltip } from '@/components/tooltips';

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#a78bfa',  // violet
  openai:    '#34d399',  // emerald
  google:    '#fbbf24',  // amber
  budget:    '#f87171',  // red — for blocked-by-budget rows
};

const fmtUsd = (n: number | null | undefined, dp = 2) =>
  n == null ? '—' : `$${n.toFixed(dp)}`;
const fmtUsdSmall = (n: number | null | undefined) =>
  n == null ? '—' : (n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`);

export default function TokensPage() {
  const [days, setDays] = useState<7 | 14 | 30 | 90>(30);
  const [groupBy, setGroupBy] = useState<'day' | 'provider' | 'feature'>('day');
  const [recentFilter, setRecentFilter] = useState<{ provider?: string; feature?: string; ticker?: string }>({});

  const headlineQ = useQuery({ queryKey: ['llm-headline'], queryFn: getLlmUsageHeadline, refetchInterval: 60_000 });
  const summaryQ = useQuery({ queryKey: ['llm-summary', days, groupBy], queryFn: () => getLlmUsageSummary(days, groupBy === 'day' ? 'day_provider' : groupBy) });
  const recentQ = useQuery({ queryKey: ['llm-recent', recentFilter], queryFn: () => getLlmRecentUsage({ limit: 100, ...recentFilter }) });
  const budgetsQ = useQuery({ queryKey: ['llm-budgets'], queryFn: getLlmBudgets });

  const headline = headlineQ.data;
  const summary = summaryQ.data;
  const budgets = budgetsQ.data?.budgets || [];

  // Build chart data — for 'day' group, pivot by provider
  let chartData: Array<Record<string, string | number>> = [];
  if (groupBy === 'day' && summary?.rows) {
    const byDay = new Map<string, Record<string, string | number>>();
    for (const r of summary.rows) {
      const day = r.day || '?';
      if (!byDay.has(day)) byDay.set(day, { day });
      const row = byDay.get(day)!;
      row[r.provider || 'unknown'] = ((row[r.provider || 'unknown'] as number) || 0) + r.cost_usd;
    }
    chartData = Array.from(byDay.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));
  } else if (summary?.rows) {
    chartData = summary.rows.map((r) => ({
      label: (r.provider || r.feature || '?'),
      cost: r.cost_usd,
      calls: r.calls,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Coins className="h-6 w-6 text-violet-400" />
            Token Usage & Budgets
            <InfoTooltip
              text="Per-call accounting for every LLM API hit. Set budgets at four scopes (global / provider / feature / provider+feature). Hard-cutoff budgets reject calls when exceeded."
              position="bottom"
            />
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Anthropic · OpenAI · Google — recorded per call with cost, latency, status</p>
        </div>
        <button
          onClick={() => { headlineQ.refetch(); summaryQ.refetch(); recentQ.refetch(); budgetsQ.refetch(); }}
          className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm text-neutral-400 hover:bg-bg/50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HeadlineCard label="Today (UTC)" value={fmtUsd(headline?.today_global_usd, 4)} loading={headlineQ.isLoading} accent="violet" />
        <HeadlineCard label="This month" value={fmtUsd(headline?.month_global_usd)} loading={headlineQ.isLoading} />
        <HeadlineCard
          label="Today by provider"
          value={
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
              {headline && Object.entries(headline.by_provider_today).map(([p, v]) => (
                <span key={p} className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: PROVIDER_COLORS[p] || '#737373' }} />
                  {p}: <span className="text-neutral-200">{fmtUsdSmall(v)}</span>
                </span>
              ))}
            </div>
          }
          loading={headlineQ.isLoading}
        />
        <HeadlineCard
          label="Total calls (last 30d)"
          value={summary ? `${summary.totals.calls.toLocaleString()}` : '—'}
          sub={summary ? `${summary.totals.tokens_in.toLocaleString()} in / ${summary.totals.tokens_out.toLocaleString()} out` : ''}
          loading={summaryQ.isLoading}
        />
      </div>

      {/* Spend chart */}
      <div className="rounded-lg border border-border bg-panel p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base">
            Spend over time
            <InfoTooltip text="Daily LLM spend, stacked by provider. Set a daily budget below to see when it's exceeded." position="top" />
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500">Window:</span>
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d as 7 | 14 | 30 | 90)}
                className={`rounded border px-2 py-1 transition ${days === d ? 'border-violet-500 text-violet-200 bg-violet-500/10' : 'border-border text-neutral-400 hover:bg-bg/50'}`}
              >
                {d}d
              </button>
            ))}
            <span className="ml-3 text-neutral-500">Group by:</span>
            {(['day', 'provider', 'feature'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`rounded border px-2 py-1 transition ${groupBy === g ? 'border-violet-500 text-violet-200 bg-violet-500/10' : 'border-border text-neutral-400 hover:bg-bg/50'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 w-full">
          {summaryQ.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-sm text-neutral-500">
              <span>No usage data yet</span>
              <span className="mt-1 text-xs text-neutral-600">Trigger an LLM call (NPV / consensus / etc.) and refresh.</span>
            </div>
          ) : groupBy === 'day' ? (
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="anth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PROVIDER_COLORS.anthropic} stopOpacity={0.6} /><stop offset="100%" stopColor={PROVIDER_COLORS.anthropic} stopOpacity={0.05} /></linearGradient>
                  <linearGradient id="oai" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PROVIDER_COLORS.openai} stopOpacity={0.6} /><stop offset="100%" stopColor={PROVIDER_COLORS.openai} stopOpacity={0.05} /></linearGradient>
                  <linearGradient id="gog" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PROVIDER_COLORS.google} stopOpacity={0.6} /><stop offset="100%" stopColor={PROVIDER_COLORS.google} stopOpacity={0.05} /></linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#525252" fontSize={11} tickMargin={6} />
                <YAxis stroke="#525252" fontSize={11} tickFormatter={(v) => `$${Number(v).toFixed(v < 1 ? 2 : 0)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', fontSize: 12 }}
                  formatter={(value: number) => [`$${value.toFixed(4)}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="anthropic" stackId="1" stroke={PROVIDER_COLORS.anthropic} fill="url(#anth)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="openai" stackId="1" stroke={PROVIDER_COLORS.openai} fill="url(#oai)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="google" stackId="1" stroke={PROVIDER_COLORS.google} fill="url(#gog)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#525252" fontSize={11} tickMargin={6} />
                <YAxis stroke="#525252" fontSize={11} tickFormatter={(v) => `$${Number(v).toFixed(v < 1 ? 2 : 0)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', fontSize: 12 }}
                  formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                />
                <Bar dataKey="cost" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Budgets editor */}
      <BudgetsPanel budgets={budgets} loading={budgetsQ.isLoading} />

      {/* Recent calls table */}
      <div className="rounded-lg border border-border bg-panel p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base">Recent calls</h2>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={recentFilter.provider || ''}
              onChange={(e) => setRecentFilter({ ...recentFilter, provider: e.target.value || undefined })}
              className="rounded border border-border bg-bg/50 px-2 py-1 text-neutral-300"
            >
              <option value="">All providers</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </select>
            <input
              type="text"
              placeholder="ticker filter"
              value={recentFilter.ticker || ''}
              onChange={(e) => setRecentFilter({ ...recentFilter, ticker: e.target.value.toUpperCase() || undefined })}
              className="w-24 rounded border border-border bg-bg/50 px-2 py-1 text-neutral-300"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-neutral-500">
              <tr className="border-b border-border/50">
                <th className="px-2 py-2 text-left">Time</th>
                <th className="px-2 py-2 text-left">Provider</th>
                <th className="px-2 py-2 text-left">Model</th>
                <th className="px-2 py-2 text-left">Feature</th>
                <th className="px-2 py-2 text-left">Ticker</th>
                <th className="px-2 py-2 text-right">In</th>
                <th className="px-2 py-2 text-right">Out</th>
                <th className="px-2 py-2 text-right">Cost</th>
                <th className="px-2 py-2 text-right">ms</th>
                <th className="px-2 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {recentQ.isLoading && (
                <tr><td colSpan={10} className="py-8 text-center text-neutral-500"><RefreshCw className="inline h-4 w-4 animate-spin" /> loading…</td></tr>
              )}
              {!recentQ.isLoading && (recentQ.data?.rows.length ?? 0) === 0 && (
                <tr><td colSpan={10} className="py-8 text-center text-neutral-500">no calls match filters</td></tr>
              )}
              {recentQ.data?.rows.map((r) => (
                <tr key={r.id} className="hover:bg-bg/40 transition">
                  <td className="px-2 py-1.5 font-mono text-neutral-400">{r.ts.slice(11, 19)}</td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: PROVIDER_COLORS[r.provider] || '#737373' }} />
                      <span className="text-neutral-300">{r.provider}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-neutral-400 truncate max-w-[160px]" title={r.model}>{r.model || '—'}</td>
                  <td className="px-2 py-1.5 text-neutral-400">{r.feature || '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-neutral-300">{r.ticker || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-neutral-400">{r.tokens_input?.toLocaleString() ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-neutral-400">{r.tokens_output?.toLocaleString() ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmtUsdSmall(r.cost_usd)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-neutral-500">{r.duration_ms ?? '—'}</td>
                  <td className={`px-2 py-1.5 text-xs ${r.status === 'success' ? 'text-emerald-400' : r.status === 'budget_blocked' ? 'text-red-400' : 'text-amber-400'}`}>
                    {r.status}
                    {r.error_message && (
                      <span className="ml-1 text-neutral-500" title={r.error_message}>· err</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HeadlineCard({ label, value, sub, loading, accent }: {
  label: string;
  value: string | React.ReactNode;
  sub?: string;
  loading?: boolean;
  accent?: 'violet';
}) {
  const valueColor = accent === 'violet' ? 'text-violet-200' : 'text-neutral-100';
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueColor}`}>
        {loading ? <span className="text-neutral-600">…</span> : value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

function BudgetsPanel({ budgets, loading }: { budgets: LlmBudget[]; loading: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LlmBudget | null>(null);
  const [adding, setAdding] = useState(false);

  const upsert = useMutation({
    mutationFn: setLlmBudget,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['llm-budgets'] }); setEditing(null); setAdding(false); },
  });
  const del = useMutation({
    mutationFn: deleteLlmBudget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-budgets'] }),
  });

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base">
          Budgets
          <InfoTooltip
            text="Set spending limits at four scope levels. When hard-cutoff is on, calls matching the scope are REJECTED if today's or this month's spend exceeds the limit. Default global budget is $25/day, $500/month, no hard cutoff."
            position="top"
          />
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded border border-violet-500/40 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/10"
        >
          <Plus className="h-3 w-3" /> Add budget
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-neutral-500">
              <tr className="border-b border-border/50">
                <th className="px-2 py-2 text-left">Scope</th>
                <th className="px-2 py-2 text-right">Daily</th>
                <th className="px-2 py-2 text-right">Monthly</th>
                <th className="px-2 py-2 text-center">Hard cutoff</th>
                <th className="px-2 py-2 text-right">Alert at</th>
                <th className="px-2 py-2 text-center">Enabled</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {budgets.map((b) => (
                <tr key={b.id} className="hover:bg-bg/40 transition">
                  <td className="px-2 py-1.5">
                    <span className="text-neutral-300">{b.scope_type}</span>
                    <span className="text-neutral-500"> · </span>
                    <span className="text-neutral-100 font-medium">{b.scope_value}</span>
                    {b.notes && <div className="mt-0.5 text-[10px] text-neutral-500">{b.notes}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmtUsd(b.daily_limit_usd, 2)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmtUsd(b.monthly_limit_usd, 2)}</td>
                  <td className="px-2 py-1.5 text-center">
                    {b.hard_cutoff
                      ? <span className="inline-flex items-center gap-1 text-red-300"><ShieldAlert className="h-3.5 w-3.5" /> ON</span>
                      : <span className="inline-flex items-center gap-1 text-neutral-500"><ShieldCheck className="h-3.5 w-3.5" /> off</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-neutral-400">{b.alert_at_pct ? `${b.alert_at_pct}%` : '—'}</td>
                  <td className="px-2 py-1.5 text-center">{b.enabled ? '✓' : '—'}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => setEditing(b)}
                      className="mx-1 text-neutral-400 hover:text-violet-300"
                      title="Edit"
                    ><Edit3 className="h-3.5 w-3.5" /></button>
                    <button
                      onClick={() => {
                        if (b.scope_type === 'global' && b.scope_value === 'global') {
                          alert('Cannot delete global default — disable it instead.');
                          return;
                        }
                        if (confirm(`Delete budget "${b.scope_type}:${b.scope_value}"?`)) del.mutate(b.id);
                      }}
                      className="mx-1 text-neutral-400 hover:text-red-400"
                      title="Delete"
                    ><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
              {budgets.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-neutral-500">no budgets configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(editing || adding) && (
        <BudgetForm
          initial={editing || { id: 0, scope_type: 'feature', scope_value: '', daily_limit_usd: null, monthly_limit_usd: null, hard_cutoff: false, alert_at_pct: 80, enabled: true }}
          isNew={adding}
          onCancel={() => { setEditing(null); setAdding(false); }}
          onSave={(data) => upsert.mutate(data)}
          submitting={upsert.isPending}
        />
      )}

      {(upsert.error || del.error) && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {(upsert.error as Error)?.message || (del.error as Error)?.message}
        </div>
      )}
    </div>
  );
}

function BudgetForm({ initial, isNew, onCancel, onSave, submitting }: {
  initial: LlmBudget;
  isNew: boolean;
  onCancel: () => void;
  onSave: (data: { scope_type: string; scope_value: string; daily_limit_usd: number | null; monthly_limit_usd: number | null; hard_cutoff: boolean; alert_at_pct: number; enabled: boolean; notes?: string }) => void;
  submitting: boolean;
}) {
  const [scopeType, setScopeType] = useState(initial.scope_type);
  const [scopeValue, setScopeValue] = useState(initial.scope_value);
  const [daily, setDaily] = useState<string>(initial.daily_limit_usd?.toString() ?? '');
  const [monthly, setMonthly] = useState<string>(initial.monthly_limit_usd?.toString() ?? '');
  const [hardCutoff, setHardCutoff] = useState(initial.hard_cutoff);
  const [alertAt, setAlertAt] = useState<number>(initial.alert_at_pct ?? 80);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [notes, setNotes] = useState(initial.notes ?? '');

  const submit = () => {
    if (!scopeValue.trim()) {
      alert('scope_value is required');
      return;
    }
    onSave({
      scope_type: scopeType,
      scope_value: scopeValue.trim(),
      daily_limit_usd: daily.trim() ? Number(daily) : null,
      monthly_limit_usd: monthly.trim() ? Number(monthly) : null,
      hard_cutoff: hardCutoff,
      alert_at_pct: alertAt,
      enabled,
      notes: notes || undefined,
    });
  };

  return (
    <div className="mt-4 rounded-md border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-violet-200">{isNew ? 'New budget' : `Editing: ${initial.scope_type}:${initial.scope_value}`}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labelled label="Scope type">
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value)} disabled={!isNew}
                  className="w-full rounded border border-border bg-bg/50 px-2 py-1 text-sm text-neutral-200">
            <option value="global">global</option>
            <option value="provider">provider</option>
            <option value="feature">feature</option>
            <option value="provider_feature">provider_feature</option>
          </select>
        </Labelled>
        <Labelled label="Scope value">
          <input type="text" value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} disabled={!isNew}
                 placeholder={scopeType === 'global' ? 'global' : scopeType === 'provider' ? 'anthropic | openai | google' : scopeType === 'feature' ? 'npv_v2 | ai_pipeline | ...' : 'anthropic:npv_v2'}
                 className="w-full rounded border border-border bg-bg/50 px-2 py-1 text-sm text-neutral-200" />
        </Labelled>
        <Labelled label="Daily limit USD (blank = no daily limit)">
          <input type="number" step="0.01" min="0" value={daily} onChange={(e) => setDaily(e.target.value)}
                 className="w-full rounded border border-border bg-bg/50 px-2 py-1 text-sm font-mono text-neutral-200" />
        </Labelled>
        <Labelled label="Monthly limit USD (blank = no monthly limit)">
          <input type="number" step="1" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)}
                 className="w-full rounded border border-border bg-bg/50 px-2 py-1 text-sm font-mono text-neutral-200" />
        </Labelled>
        <Labelled label="Alert at % of limit">
          <input type="number" step="1" min="0" max="100" value={alertAt} onChange={(e) => setAlertAt(Number(e.target.value))}
                 className="w-full rounded border border-border bg-bg/50 px-2 py-1 text-sm font-mono text-neutral-200" />
        </Labelled>
        <Labelled label="Notes">
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                 className="w-full rounded border border-border bg-bg/50 px-2 py-1 text-sm text-neutral-200" />
        </Labelled>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={hardCutoff} onChange={(e) => setHardCutoff(e.target.checked)} />
          <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
          Hard cutoff (REJECT calls when over budget)
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-border px-3 py-1.5 text-xs text-neutral-400 hover:bg-bg/50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-neutral-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
