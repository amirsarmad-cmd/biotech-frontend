'use client';

import { useState, useEffect } from 'react';
import { Brain, Loader2, AlertCircle } from 'lucide-react';
import { startConsensus, getJob, type StockDetail, type NPVFull, type NewsArticle, type JobStatus } from '@/lib/api';

interface Props {
  ticker: string;
  companyName: string;
  catalyst: { type: string; date: string; probability: number; description: string };
  npv?: NPVFull | null;
  news?: NewsArticle[];
}

interface ParallelResult {
  draft?: string;
  gemini_critique?: string;
  gpt_critique?: string;
  revised?: string | null;
  base_probability?: number;
  ai_probability?: number;
  probabilities_all?: {
    claude_draft?: number | null;
    gemini?: number | null;
    gpt?: number | null;
    final?: number | null;
  };
  elapsed_seconds?: number;
}

interface ConsensusResult {
  parallel?: ParallelResult;
  consensus?: { revised?: string; final_probability?: number | null } | string | null;
}

type Phase = 'idle' | 'queued' | 'running' | 'completed' | 'failed';

export function AIConsensusPanel({ ticker, companyName, catalyst, npv, news }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<ConsensusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'consensus' | 'claude' | 'gemini' | 'gpt'>('consensus');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'queued' && phase !== 'running') return;
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Poll job
  useEffect(() => {
    if (!jobId || (phase !== 'queued' && phase !== 'running')) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const s: JobStatus = await getJob(jobId);
        if (cancelled) return;
        if (s.status === 'running') setPhase('running');
        if (s.status === 'completed') {
          setResult((s.result as ConsensusResult) || null);
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
    setError(null);
    setResult(null);
    setElapsed(0);
    setPhase('queued');
    try {
      const r = await startConsensus({
        ticker,
        company_name: companyName,
        catalyst_info: catalyst,
        drug_info: {
          peak_sales_b: npv?.peak_sales_b,
          multiple: npv?.multiple,
          commercial_prob: npv?.p_commercial,
          peak_sales_rationale: npv?.peak_sales_rationale,
          multiple_rationale: npv?.multiple_rationale,
          commercial_rationale: npv?.commercial_rationale,
        },
        sources: (news || []).slice(0, 10).map((n) => ({
          title: n.title, source: n.source, date: n.date, url: n.url,
        })),
      });
      setJobId(r.job_id);
    } catch (e) {
      setError((e as Error).message);
      setPhase('failed');
    }
  };

  const parallel = result?.parallel;
  const probs = parallel?.probabilities_all;
  const consensus = result?.consensus;
  const consensusText = typeof consensus === 'string' ? consensus : (consensus?.revised || '');
  const consensusProb = typeof consensus === 'object' ? consensus?.final_probability : null;

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg">AI Investment Analysis</h3>
        </div>
        {phase === 'idle' && (
          <button
            onClick={start}
            className="rounded-md border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-sm text-purple-300 hover:bg-purple-500/20 transition"
          >
            Run 3-model analysis
          </button>
        )}
      </div>

      {phase === 'idle' && !result && (
        <div className="rounded-md border border-border bg-bg/50 p-4 text-sm text-neutral-400">
          Run Claude Sonnet 4.5, Gemini 2.5, and GPT-4o in parallel against this catalyst. Includes:
          evidence table, precedent comparables, bull/bear thesis, sub-factor scores, and a triangulated
          consensus probability. Takes ~30-60s.
        </div>
      )}

      {(phase === 'queued' || phase === 'running') && (
        <div className="rounded-md border border-border bg-bg/50 p-4 text-sm">
          <div className="flex items-center gap-2 text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
            {phase === 'queued' ? 'Queued…' : '3 models analyzing in parallel'}
            <span className="ml-auto font-mono text-xs text-neutral-500">{elapsed}s</span>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            🟣 Claude Sonnet 4.5 · 🔵 Gemini 2.5 · 🟢 GPT-4o
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
              <button onClick={start} className="mt-3 text-xs text-purple-300 hover:underline">Try again</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'completed' && result && (
        <div>
          {/* Probability summary */}
          {probs && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ProbCard label="Base" pct={parallel?.base_probability} muted />
              <ProbCard label="🟣 Claude" pct={probs.claude_draft} />
              <ProbCard label="🔵 Gemini" pct={probs.gemini} />
              <ProbCard label="🟢 GPT" pct={probs.gpt} />
            </div>
          )}

          {consensusProb != null && (
            <div className="mb-4 rounded-md border border-purple-500/30 bg-purple-500/5 p-3 text-center">
              <div className="text-xs uppercase tracking-wide text-purple-300">Consensus probability</div>
              <div className="mt-0.5 text-2xl font-bold text-purple-200">
                {(consensusProb * 100).toFixed(0)}%
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="mb-3 flex gap-1 border-b border-border">
            {[
              { id: 'consensus', label: 'Consensus' },
              { id: 'claude', label: '🟣 Claude' },
              { id: 'gemini', label: '🔵 Gemini' },
              { id: 'gpt', label: '🟢 GPT' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-3 py-1.5 text-sm border-b-2 ${
                  activeTab === t.id
                    ? 'border-purple-400 text-purple-300'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="prose-sm max-w-none text-sm text-neutral-300">
            {activeTab === 'consensus' && <Markdown text={consensusText} />}
            {activeTab === 'claude' && <Markdown text={parallel?.draft || ''} />}
            {activeTab === 'gemini' && <Markdown text={parallel?.gemini_critique || ''} />}
            {activeTab === 'gpt' && <Markdown text={parallel?.gpt_critique || ''} />}
          </div>

          {parallel?.elapsed_seconds != null && (
            <div className="mt-4 text-xs text-neutral-600 font-mono">
              Completed in {parallel.elapsed_seconds.toFixed(1)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProbCard({ label, pct, muted }: { label: string; pct?: number | null; muted?: boolean }) {
  if (pct == null) {
    return (
      <div className="rounded-md border border-border bg-bg/40 p-2 text-center">
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-sm font-mono text-neutral-600">—</div>
      </div>
    );
  }
  const color = pct >= 0.7 ? 'text-emerald-400' : pct >= 0.5 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="rounded-md border border-border bg-bg/40 p-2 text-center">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-lg font-mono ${muted ? 'text-neutral-400' : color}`}>{(pct * 100).toFixed(0)}%</div>
    </div>
  );
}

/** Lightweight markdown renderer (headings, bold, lists, tables). */
function Markdown({ text }: { text: string }) {
  if (!text) return <div className="text-neutral-500 italic">No content.</div>;
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let inList = false;
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    out.push(
      <table key={`t-${out.length}`} className="my-3 w-full text-xs border-collapse">
        <tbody>
          {tableRows.map((row, ri) => (
            <tr key={ri} className={ri === 0 ? 'border-b border-border' : ''}>
              {row.map((cell, ci) => (
                <td key={ci} className={`p-1.5 align-top ${ri === 0 ? 'font-semibold text-neutral-200' : 'text-neutral-400'}`}>
                  {renderInline(cell.trim())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
    tableRows = [];
  };

  lines.forEach((line, i) => {
    // Skip table separator lines |---|---|
    if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) return;
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) { if (inList) { out.push(<div key={`endl-${i}`} />); inList = false; } inTable = true; }
      const cells = line.trim().slice(1, -1).split('|');
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable();
      inTable = false;
    }
    if (line.startsWith('## ')) {
      if (inList) inList = false;
      out.push(<h4 key={i} className="mt-4 mb-1 text-sm font-semibold text-neutral-100">{line.slice(3)}</h4>);
    } else if (line.startsWith('# ')) {
      out.push(<h3 key={i} className="mt-4 mb-1 text-base font-semibold text-neutral-100">{line.slice(2)}</h3>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      out.push(<li key={i} className="ml-5 list-disc text-neutral-300">{renderInline(line.slice(2))}</li>);
      inList = true;
    } else if (line.trim() === '') {
      out.push(<div key={i} className="h-2" />);
      inList = false;
    } else {
      out.push(<p key={i} className="my-1 leading-relaxed text-neutral-300">{renderInline(line)}</p>);
    }
  });
  if (inTable) flushTable();
  return <div>{out}</div>;
}

function renderInline(s: string): React.ReactNode {
  // **bold** support
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-neutral-100">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
