'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { InfoTooltip } from './tooltips';
import { HELP } from '@/lib/help-text';
import { getStrategies } from '@/lib/api';

interface Props {
  ticker: string;
  aiProb?: number;
  daysToCatalyst?: number;
}

interface Technicals {
  available?: boolean;
  current?: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  rsi?: number;
  support?: number;
  resistance?: number;
  hi_52w?: number;
  lo_52w?: number;
  pos_52w?: number;
  hist_volatility?: number;
}

interface Setup {
  direction?: string;
  direction_explanation?: string;
  volatility_regime?: string;
  volatility_explanation?: string;
  convexity?: string;
  trend?: string;
  rsi_regime?: string;
}

interface Recommendation {
  strategy_key: string;
  name: string;
  fit_score: number;
  reasoning: string;
  why_chosen: string[];
  bias: 'long' | 'short' | 'neutral' | string;
  iv_pref: string;
  risk: 'conservative' | 'moderate' | 'aggressive' | string;
  rank: number;
}

interface OptionsChain {
  available?: boolean;
  expiry?: string;
  days_to_expiry?: number;
  atm_iv?: number;
  all_expiries?: string[];
}

interface StrategyResponse {
  ticker: string;
  inputs: { ai_prob: number; days_to_catalyst: number; atm_iv?: number | null };
  technicals: Technicals;
  setup: Setup;
  options_chain: OptionsChain;
  recommendations: Recommendation[];
}

export function StrategyPanel({ ticker, aiProb = 0.7, daysToCatalyst = 90 }: Props) {
  const q = useQuery({
    queryKey: ['strategies', ticker, aiProb, daysToCatalyst],
    queryFn: () => getStrategies(ticker, { ai_prob: aiProb, days_to_catalyst: daysToCatalyst }) as Promise<StrategyResponse>,
    staleTime: 5 * 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h3 className="mb-3 text-lg">Trade Strategy <InfoTooltip text={HELP.stockDetail.trade_strategy} position="bottom" /></h3>
        <div className="h-40 animate-pulse rounded-md border border-border bg-bg/50" />
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h3 className="mb-3 text-lg">Trade Strategy <InfoTooltip text={HELP.stockDetail.trade_strategy} position="bottom" /></h3>
        <p className="text-sm text-neutral-500">{(q.error as Error)?.message || 'Strategy data unavailable.'}</p>
      </div>
    );
  }

  const { technicals, setup, options_chain, recommendations, inputs } = q.data;

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg flex items-center gap-2"><Target className="h-5 w-5 text-emerald-400" /> Trade Strategy</h3>
        <span className="text-xs text-neutral-500">
          AI prob {(inputs.ai_prob * 100).toFixed(0)}% · {inputs.days_to_catalyst}d to catalyst
        </span>
      </div>

      {/* Setup classification row */}
      {setup && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SetupCard label="Direction" value={setup.direction} explanation={setup.direction_explanation}
                     icon={
                       setup.direction === 'bullish' ? <TrendingUp className="h-3 w-3" /> :
                       setup.direction === 'bearish' ? <TrendingDown className="h-3 w-3" /> :
                       <Minus className="h-3 w-3" />
                     }
                     color={setup.direction === 'bullish' ? 'emerald' : setup.direction === 'bearish' ? 'red' : 'neutral'} />
          <SetupCard label="Volatility" value={setup.volatility_regime} explanation={setup.volatility_explanation}
                     color={setup.volatility_regime === 'high' ? 'amber' : 'neutral'} />
          <SetupCard label="Trend" value={setup.trend} color="neutral" />
          <SetupCard label="RSI" value={setup.rsi_regime} color={setup.rsi_regime === 'overbought' ? 'amber' : 'neutral'} />
        </div>
      )}

      {/* Technicals row */}
      {technicals?.available !== false && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <TechCell label="Price" value={technicals.current != null ? `$${technicals.current.toFixed(2)}` : '—'} />
          <TechCell label="MA20" value={technicals.ma20 != null ? `$${technicals.ma20.toFixed(2)}` : '—'} />
          <TechCell label="MA50" value={technicals.ma50 != null ? `$${technicals.ma50.toFixed(2)}` : '—'} />
          <TechCell label="MA200" value={technicals.ma200 != null ? `$${technicals.ma200.toFixed(2)}` : '—'} />
          <TechCell label="RSI" value={technicals.rsi != null ? technicals.rsi.toFixed(0) : '—'}
                    color={technicals.rsi != null && technicals.rsi > 70 ? 'amber' : technicals.rsi != null && technicals.rsi < 30 ? 'red' : 'neutral'} />
          <TechCell label="HV" value={technicals.hist_volatility != null ? `${(technicals.hist_volatility * 100).toFixed(0)}%` : '—'} />
          <TechCell label="IV" value={inputs.atm_iv != null ? `${(inputs.atm_iv * 100).toFixed(0)}%` : '—'}
                    color={inputs.atm_iv != null && inputs.atm_iv > 0.6 ? 'amber' : 'neutral'} />
        </div>
      )}

      {technicals?.support != null && technicals?.resistance != null && (
        <div className="mt-3 text-xs text-neutral-500 font-mono">
          Support ${technicals.support.toFixed(2)} · Resistance ${technicals.resistance.toFixed(2)}
          {technicals.lo_52w != null && technicals.hi_52w != null && (
            <span className="ml-3">52w ${technicals.lo_52w.toFixed(2)}–${technicals.hi_52w.toFixed(2)}</span>
          )}
          {technicals.pos_52w != null && (
            <span className="ml-3 text-neutral-600">({(technicals.pos_52w * 100).toFixed(0)}% of range)</span>
          )}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Recommended strategies ({recommendations.length})
            {options_chain.expiry && (
              <span className="ml-2 text-neutral-600">· options expire {options_chain.expiry}</span>
            )}
          </div>
          <div className="space-y-2">
            {recommendations.map((r) => (
              <div key={r.strategy_key} className="rounded-md border border-border bg-bg/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm bg-emerald-500/10 px-2 py-0.5 text-xs font-mono text-emerald-300">
                      #{r.rank}
                    </span>
                    <span className="font-medium text-neutral-100">{r.name}</span>
                    <span className={`rounded-sm px-1.5 py-0.5 text-xs ${
                      r.bias === 'long' ? 'bg-emerald-500/10 text-emerald-300'
                      : r.bias === 'short' ? 'bg-red-500/10 text-red-300'
                      : 'bg-neutral-500/10 text-neutral-300'
                    }`}>
                      {r.bias}
                    </span>
                    <span className={`rounded-sm px-1.5 py-0.5 text-xs ${
                      r.risk === 'aggressive' ? 'bg-amber-500/10 text-amber-300'
                      : r.risk === 'moderate' ? 'bg-blue-500/10 text-blue-300'
                      : 'bg-neutral-500/10 text-neutral-300'
                    }`}>
                      {r.risk}
                    </span>
                  </div>
                  <div className="text-sm font-mono text-emerald-400">{r.fit_score}</div>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{r.reasoning}</p>
                <ul className="mt-2 space-y-0.5 text-xs text-neutral-400">
                  {r.why_chosen.map((reason, i) => (
                    <li key={i}>• {reason}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SetupCard({
  label, value, explanation, icon, color = 'neutral'
}: {
  label: string;
  value?: string;
  explanation?: string;
  icon?: React.ReactNode;
  color?: 'emerald' | 'red' | 'amber' | 'neutral';
}) {
  const cls = {
    emerald: 'border-emerald-500/30 text-emerald-300',
    red: 'border-red-500/30 text-red-300',
    amber: 'border-amber-500/30 text-amber-300',
    neutral: 'border-border text-neutral-300',
  }[color];
  return (
    <div className={`rounded-md border bg-bg/50 p-3 ${cls}`} title={explanation}>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 flex items-center gap-1 text-sm font-medium capitalize">
        {icon} {value || '—'}
      </div>
    </div>
  );
}

function TechCell({ label, value, color = 'neutral' }: { label: string; value: string; color?: string }) {
  const cls = color === 'amber' ? 'text-amber-300' : color === 'red' ? 'text-red-300' : 'text-neutral-200';
  return (
    <div className="rounded-md border border-border bg-bg/40 p-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-sm font-mono ${cls}`}>{value}</div>
    </div>
  );
}
