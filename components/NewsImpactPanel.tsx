'use client';

import { useState, useEffect } from 'react';
import { Newspaper, Loader2, AlertCircle, AlertTriangle, TrendingUp, TrendingDown, Shield } from 'lucide-react';
import { startNewsImpact, getJob, type NPVFull, type NewsArticle, type JobStatus } from '@/lib/api';

interface Props {
  ticker: string;
  companyName: string;
  currentPrice: number | null;
  marketCapM: number;
  npv?: NPVFull | null;
  catalyst: { type: string; date: string };
  news?: NewsArticle[];
}

interface MaterialEvent {
  headline: string;
  source: string;
  date: string;
  direction: 'positive' | 'negative' | 'neutral' | string;
  npv_impact_pct: number;
  priced_in_pct: number;
  rationale: string;
}

interface NewsImpactResult {
  summary: string;
  net_npv_adjustment_pct: number;
  priced_in_assessment: string;
  material_events: MaterialEvent[];
  news_driven_probability_delta_pp: number;
  new_risks_flagged: string[];
  new_tailwinds_flagged: string[];
  hedge_suggestion: string | null;
  adjusted_drug_npv_b?: number;
  adjusted_npv_impact_pct?: number;
  error?: string | null;
}

type Phase = 'idle' | 'queued' | 'running' | 'completed' | 'failed';

export function NewsImpactPanel({
  ticker, companyName, currentPrice, marketCapM, npv, catalyst, news,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<NewsImpactResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'queued' && phase !== 'running') return;
    const start = Date.now();
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(i);
  }, [phase]);

  useEffect(() => {
    if (!jobId || (phase !== 'queued' && phase !== 'running')) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const s: JobStatus = await getJob(jobId);
        if (cancelled) return;
        if (s.status === 'running') setPhase('running');
        if (s.status === 'completed') {
          setResult(((s.result as unknown) as NewsImpactResult) || null);
          setPhase('completed');
          return;
        }
        if (s.status === 'failed') {
          setError(s.error || 'Job failed without an error message.');
          setPhase('failed');
          return;
        }
        setTimeout(poll, 3000);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setPhase('failed');
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [jobId, phase]);

  const start = async () => {
    if (!currentPrice || !marketCapM || !npv?.peak_sales_b || !npv?.multiple || !npv?.p_commercial) {
      setError('Cannot run news analysis without complete NPV data.');
      setPhase('failed');
      return;
    }
    setError(null); setResult(null); setElapsed(0); setPhase('queued');
    try {
      const r = await startNewsImpact({
        ticker,
        company_name: companyName,
        catalyst_type: catalyst.type,
        catalyst_date: catalyst.date,
        current_price: currentPrice,
        market_cap_b: marketCapM / 1000,
        drug_npv_b: (npv?.drug_npv_m || 0) / 1000,
        peak_sales_b: npv?.peak_sales_b ?? 0,
        multiple: npv?.multiple ?? 0,
        p_commercial: npv?.p_commercial ?? 0,
        fundamental_impact_pct: npv?.fundamental_impact_pct ?? 0,
        implied_move_pct: npv?.implied_move_pct ?? 0,
        baseline_days: npv?.baseline_days ?? 30,
        articles: (news || []).slice(0, 15).map((n) => ({
          title: n.title, source: n.source, date: n.date, summary: n.summary || '',
        })),
      });
      setJobId(r.job_id);
    } catch (e) {
      setError((e as Error).message);
      setPhase('failed');
    }
  };

  const netAdj = result?.net_npv_adjustment_pct ?? 0;
  const probDelta = result?.news_driven_probability_delta_pp ?? 0;

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg">News Impact on NPV <span className="text-xs font-normal text-neutral-500">Section 2C</span></h3>
        </div>
        {phase === 'idle' && (
          <button
            onClick={start}
            className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-300 hover:bg-blue-500/20 transition"
          >
            Analyze news
          </button>
        )}
      </div>

      {phase === 'idle' && !result && (
        <div className="rounded-md border border-border bg-bg/50 p-4 text-sm text-neutral-400">
          Have an LLM read the recent news, identify material events, score how each affects NPV
          (positive/negative/neutral) and how much is already priced in. Outputs: net NPV adjustment,
          probability delta, new risks, tailwinds, hedge suggestion. Takes ~30-60s.
        </div>
      )}

      {(phase === 'queued' || phase === 'running') && (
        <div className="rounded-md border border-border bg-bg/50 p-4 text-sm">
          <div className="flex items-center gap-2 text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            {phase === 'queued' ? 'Queued…' : 'LLM analyzing news against NPV model'}
            <span className="ml-auto font-mono text-xs text-neutral-500">{elapsed}s</span>
          </div>
        </div>
      )}

      {phase === 'failed' && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="font-medium text-red-300">Analysis failed</div>
              <div className="mt-1 text-xs text-red-400/70">{error}</div>
              <button onClick={start} className="mt-3 text-xs text-blue-300 hover:underline">Try again</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'completed' && result && (
        <div className="space-y-4">
          {/* Top metrics row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={`rounded-md border p-3 ${
              netAdj > 0.5 ? 'border-emerald-500/30 bg-emerald-500/5'
              : netAdj < -0.5 ? 'border-red-500/30 bg-red-500/5'
              : 'border-border bg-bg/50'
            }`}>
              <div className="text-xs uppercase tracking-wide text-neutral-500">Net NPV adjustment</div>
              <div className={`mt-1 text-2xl font-semibold ${
                netAdj > 0.5 ? 'text-emerald-400' : netAdj < -0.5 ? 'text-red-400' : 'text-neutral-200'
              }`}>
                {netAdj > 0 ? '+' : ''}{netAdj.toFixed(1)}%
              </div>
              {result.adjusted_drug_npv_b != null && (
                <div className="mt-1 text-xs text-neutral-500 font-mono">
                  → ${result.adjusted_drug_npv_b.toFixed(2)}B adjusted
                </div>
              )}
            </div>
            <div className={`rounded-md border p-3 ${
              probDelta > 0 ? 'border-emerald-500/30 bg-emerald-500/5'
              : probDelta < 0 ? 'border-red-500/30 bg-red-500/5'
              : 'border-border bg-bg/50'
            }`}>
              <div className="text-xs uppercase tracking-wide text-neutral-500">Probability delta</div>
              <div className={`mt-1 text-2xl font-semibold ${
                probDelta > 0 ? 'text-emerald-400' : probDelta < 0 ? 'text-red-400' : 'text-neutral-200'
              }`}>
                {probDelta > 0 ? '+' : ''}{probDelta} pp
              </div>
              <div className="mt-1 text-xs text-neutral-500">News-driven shift</div>
            </div>
            <div className="rounded-md border border-border bg-bg/50 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Material events</div>
              <div className="mt-1 text-2xl font-semibold text-neutral-200">{result.material_events.length}</div>
              <div className="mt-1 text-xs text-neutral-500">In recent coverage</div>
            </div>
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="rounded-md border border-border bg-bg/40 p-3 text-sm text-neutral-300 leading-relaxed">
              {result.summary}
            </div>
          )}

          {/* Priced-in assessment */}
          {result.priced_in_assessment && (
            <div className="rounded-md border border-border bg-bg/40 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Priced-in assessment</div>
              <p className="text-neutral-300 leading-relaxed">{result.priced_in_assessment}</p>
            </div>
          )}

          {/* Material events */}
          {result.material_events.length > 0 && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
                Material events ({result.material_events.length})
              </div>
              <div className="space-y-2">
                {result.material_events.map((ev, i) => {
                  const dir = ev.direction.toLowerCase();
                  const dirColor =
                    dir === 'positive' ? 'border-emerald-500/30 bg-emerald-500/5'
                    : dir === 'negative' ? 'border-red-500/30 bg-red-500/5'
                    : 'border-border bg-bg/40';
                  const dirIcon =
                    dir === 'positive' ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                    : dir === 'negative' ? <TrendingDown className="h-3 w-3 text-red-400" />
                    : null;
                  return (
                    <div key={i} className={`rounded-md border p-3 ${dirColor}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            {dirIcon}
                            <span className="font-medium text-neutral-400">{ev.source}</span>
                            <span>·</span>
                            <span>{ev.date}</span>
                          </div>
                          <div className="mt-1 text-sm font-medium text-neutral-100">{ev.headline}</div>
                        </div>
                        <div className="shrink-0 text-right text-xs">
                          <div className={dir === 'positive' ? 'text-emerald-400 font-mono' : dir === 'negative' ? 'text-red-400 font-mono' : 'text-neutral-400 font-mono'}>
                            {ev.npv_impact_pct > 0 ? '+' : ''}{ev.npv_impact_pct.toFixed(1)}% NPV
                          </div>
                          <div className="text-neutral-600">{ev.priced_in_pct}% priced in</div>
                        </div>
                      </div>
                      {ev.rationale && (
                        <p className="mt-2 text-xs text-neutral-400 leading-relaxed">{ev.rationale}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Risks + Tailwinds */}
          {(result.new_risks_flagged.length > 0 || result.new_tailwinds_flagged.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {result.new_risks_flagged.length > 0 && (
                <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-red-300">
                    <AlertTriangle className="h-3 w-3" /> New risks flagged
                  </div>
                  <ul className="space-y-1 text-xs text-neutral-300">
                    {result.new_risks_flagged.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              )}
              {result.new_tailwinds_flagged.length > 0 && (
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-300">
                    <TrendingUp className="h-3 w-3" /> New tailwinds flagged
                  </div>
                  <ul className="space-y-1 text-xs text-neutral-300">
                    {result.new_tailwinds_flagged.map((t, i) => <li key={i}>• {t}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Hedge suggestion */}
          {result.hedge_suggestion && (
            <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                <div className="text-sm">
                  <div className="text-xs uppercase tracking-wide text-blue-300 mb-1">Hedge suggestion</div>
                  <p className="text-neutral-300 leading-relaxed">{result.hedge_suggestion}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
