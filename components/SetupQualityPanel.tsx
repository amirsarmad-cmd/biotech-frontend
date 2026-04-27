'use client';

/**
 * SetupQualityPanel — surfaces "is this setup crowded?" before the catalyst
 *
 * After NTLA Phase 3 readout (success → -30% on the day), user pushback:
 *   "We need to filter on setup quality, not just catalyst presence. Stock
 *    ran 50% into the event, sentiment euphoric, low SI, near 52w highs."
 *
 * This panel shows the 6 axes scored by the backend's setup_quality service:
 *   runup            — 30d price change
 *   week52_position  — distance from 52w high
 *   short_interest   — SI as % of float (low = crowded long)
 *   iv_euphoria      — options-implied move (high = lottery-ticket buying)
 *   sentiment        — retail polarity (>0.7 = pile-in risk)
 *   insider_activity — alignment proxy
 *
 * For NTLA on its readout day: score=0.10, flag=red, verdict="Crowded
 * long — sell-the-news risk". User would have seen this BEFORE entering.
 */

import React from 'react';
import { Activity, AlertTriangle, ShieldCheck, Gauge } from 'lucide-react';
import type { SetupQuality, SetupQualityAxis } from '@/lib/api';

interface Props {
  setup: SetupQuality | null | undefined;
}

const AXIS_LABELS: Record<string, string> = {
  runup: '30-day run-up',
  week52_position: '52-week position',
  short_interest: 'Short interest',
  iv_euphoria: 'Options pricing',
  sentiment: 'Retail sentiment',
  insider_activity: 'Insider ownership',
};

const AXIS_ICONS: Record<string, string> = {
  runup: '📈',
  week52_position: '📍',
  short_interest: '⚖️',
  iv_euphoria: '🎰',
  sentiment: '📣',
  insider_activity: '🤝',
};

function flagColor(flag: string): { bar: string; text: string; bg: string } {
  switch (flag) {
    case 'green':
      return { bar: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/5' };
    case 'amber':
      return { bar: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/5' };
    case 'red':
      return { bar: 'bg-red-400', text: 'text-red-300', bg: 'bg-red-500/5' };
    default:
      return { bar: 'bg-neutral-500', text: 'text-neutral-400', bg: 'bg-neutral-500/5' };
  }
}

function AxisRow({ name, axis }: { name: string; axis: SetupQualityAxis }) {
  const c = flagColor(axis.flag);
  const label = AXIS_LABELS[name] || name.replace(/_/g, ' ');
  const icon = AXIS_ICONS[name] || '•';
  return (
    <div className="rounded border border-border bg-bg/40 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-neutral-300">
          <span aria-hidden>{icon}</span>
          <span className="font-medium">{label}</span>
        </div>
        <span className={`text-[10px] font-mono ${c.text}`}>
          {axis.score != null ? `${(axis.score * 100).toFixed(0)}%` : '—'}
        </span>
      </div>
      {axis.score != null && (
        <div className="h-1 rounded-full bg-neutral-800/60 overflow-hidden">
          <div className={`h-full ${c.bar} transition-all`} style={{ width: `${axis.score * 100}%` }} />
        </div>
      )}
      <div className="text-[10px] text-neutral-500 leading-snug">
        {axis.note}
      </div>
    </div>
  );
}

export function SetupQualityPanel({ setup }: Props) {
  if (!setup || setup.score == null) {
    return null;
  }
  const c = flagColor(setup.flag);
  const Icon = setup.flag === 'red' ? AlertTriangle : setup.flag === 'green' ? ShieldCheck : Gauge;

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-400" />
            Trade setup quality
          </h3>
          <p className="text-xs text-neutral-500 mt-1 leading-snug max-w-2xl">
            Independent of catalyst probability. Scores how crowded / euphoric
            the entry is. A great catalyst on a crowded long is a sell-the-news
            trade — even on a perfect print.
          </p>
        </div>

        {/* Headline score badge */}
        <div className={`shrink-0 rounded-md border px-4 py-3 ${c.bg} border-${setup.flag === 'red' ? 'red' : setup.flag === 'green' ? 'emerald' : 'amber'}-500/30`}>
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${c.text}`} />
            <span className={`text-2xl font-mono ${c.text}`}>{(setup.score * 100).toFixed(0)}</span>
            <span className="text-[10px] text-neutral-500">/100</span>
          </div>
          <div className={`text-[10px] uppercase tracking-wide mt-0.5 ${c.text}`}>
            {setup.verdict}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {setup.warnings && setup.warnings.length > 0 && (
        <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-red-300 font-medium">
            ⚠ Setup concerns
          </div>
          {setup.warnings.map((w, i) => (
            <div key={i} className="text-xs text-neutral-300 leading-snug">{w}</div>
          ))}
        </div>
      )}

      {/* Per-axis breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <AxisRow name="runup" axis={setup.axes.runup} />
        <AxisRow name="week52_position" axis={setup.axes.week52_position} />
        <AxisRow name="short_interest" axis={setup.axes.short_interest} />
        <AxisRow name="iv_euphoria" axis={setup.axes.iv_euphoria} />
        <AxisRow name="sentiment" axis={setup.axes.sentiment} />
        <AxisRow name="insider_activity" axis={setup.axes.insider_activity} />
      </div>

      {/* Methodology footer */}
      <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-neutral-500 leading-snug">
        Each axis ranges 0 (bad-entry) to 1 (good-entry). Score is the mean
        of populated axes. Reds indicate the dimensions where the setup is
        most concerning. NTLA-style sell-the-news (success → -30%) typically
        scores below 30 because of run-up + crowded long + euphoric IV.
      </div>
    </div>
  );
}
