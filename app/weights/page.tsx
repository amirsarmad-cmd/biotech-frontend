'use client';

import { useState, useEffect } from 'react';
import { Sliders, RotateCcw, Save, Info } from 'lucide-react';
import { InfoTooltip } from '@/components/tooltips';
import { HELP } from '@/lib/help-text';

const STORAGE_KEY = 'biotech-screener:weights';

const EXAMPLE_VALS: Record<string, number> = {
  catalyst_probability: 0.85,
  news_sentiment: 0.6,
  news_activity: 0.7,
  market_cap: 0.4,
  days_proximity: 0.95,
};

const FACTORS = [
  { key: 'catalyst_probability', label: '🎯 Catalyst probability', defaultW: 0.35, help: 'How likely the catalyst itself is to be approved/positive' },
  { key: 'news_sentiment', label: '📰 News sentiment', defaultW: 0.15, help: 'Polarity of recent news coverage' },
  { key: 'news_activity', label: '📊 News activity', defaultW: 0.10, help: 'Volume of news articles in last 30 days' },
  { key: 'market_cap', label: '💰 Market cap', defaultW: 0.10, help: 'Higher market cap = more institutional eyeballs' },
  { key: 'days_proximity', label: '⏳ Days proximity', defaultW: 0.30, help: 'How close the catalyst is — closer = more imminent' },
];

export default function WeightsPage() {
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return Object.fromEntries(FACTORS.map((f) => [f.key, f.defaultW]));
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return Object.fromEntries(FACTORS.map((f) => [f.key, f.defaultW]));
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  const isBalanced = Math.abs(total - 1.0) < 0.01;

  const handleChange = (key: string, val: number) => {
    setWeights((w) => ({ ...w, [key]: val }));
    setSavedAt(null);
  };

  const handleNormalize = () => {
    const sum = Object.values(weights).reduce((s, w) => s + w, 0);
    if (sum === 0) return;
    setWeights((w) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / sum])));
    setSavedAt(null);
  };

  const handleReset = () => {
    setWeights(Object.fromEntries(FACTORS.map((f) => [f.key, f.defaultW])));
    setSavedAt(null);
  };

  const handleSave = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2"><Sliders className="h-6 w-6 text-purple-400" /> Rating Weights <InfoTooltip text={HELP.weights.title} position="bottom" size="md" /></h1>
        <p className="text-sm text-neutral-500 mt-1">
          Adjust the weighted scoring factors used to compute the overall stock rating. Saved locally in your browser.
        </p>
      </div>

      <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
        <div className="flex items-start gap-2 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div className="text-neutral-300">
            These weights drive the <strong>Rating breakdown</strong> shown on each stock's detail page. Adjust to emphasize
            what matters most to you — for example, raise <code className="text-neutral-100">days proximity</code> if you only care about imminent catalysts.
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-panel p-6 space-y-5">
        {FACTORS.map((f) => (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-neutral-100">{f.label}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{f.help}</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={(weights[f.key] ?? f.defaultW).toFixed(2)}
                  onChange={(e) => handleChange(f.key, Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
                  className="w-20 rounded-md border border-border bg-bg/50 px-2 py-1 text-right font-mono text-sm text-neutral-100 focus:border-accent focus:outline-none"
                />
                <span className="text-xs text-neutral-500 w-10 text-right">
                  {((weights[f.key] ?? f.defaultW) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={weights[f.key] ?? f.defaultW}
              onChange={(e) => handleChange(f.key, parseFloat(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
        ))}

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-neutral-500">Total weight:</span>{' '}
              <strong className={`font-mono ${isBalanced ? 'text-emerald-400' : 'text-amber-400'}`}>
                {total.toFixed(2)}
              </strong>
              {!isBalanced && (
                <span className="ml-2 text-xs text-amber-400/80">
                  (should sum to 1.00)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1">
                <button
                  onClick={handleNormalize}
                  disabled={isBalanced || total === 0}
                  className="rounded-md border border-border bg-bg/50 px-3 py-1.5 text-sm text-neutral-300 hover:border-emerald-500/40 hover:text-emerald-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Normalize to 1.00
                </button>
                <InfoTooltip text={HELP.weights.normalize} position="top" />
              </span>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg/50 px-3 py-1.5 text-sm text-neutral-300 hover:text-neutral-100 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
          {savedAt && (
            <div className="mt-2 text-xs text-emerald-400">Saved at {savedAt}</div>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="text-lg mb-3">Preview — example stock with these weights</h2>
        <div className="space-y-2">
          {FACTORS.map((f) => {
            const exampleVal = EXAMPLE_VALS[f.key] ?? 0.5;
            const w = weights[f.key] ?? f.defaultW;
            const contribution = exampleVal * w;
            return (
              <div key={f.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-300">{f.label}</span>
                  <span className="font-mono text-neutral-500">
                    {(exampleVal * 100).toFixed(0)}% × {(w * 100).toFixed(0)}% = {contribution.toFixed(3)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${exampleVal * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 border-t border-border pt-3 text-sm font-mono">
          Overall: <strong className="text-neutral-100">
            {FACTORS.reduce((s, f) => {
              const exampleVal = EXAMPLE_VALS[f.key] ?? 0.5;
              return s + exampleVal * (weights[f.key] ?? f.defaultW);
            }, 0).toFixed(2)}
          </strong> / 1.00
        </div>
      </div>
    </div>
  );
}
