'use client';

import { InfoTooltip } from './tooltips';
import { HELP } from '@/lib/help-text';

import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Legend,
} from 'recharts';
import type { HistoryResponse, Catalyst } from '@/lib/api';

const PERIODS = ['3mo', '6mo', '1y', '2y'] as const;
type Period = typeof PERIODS[number];

const CATALYST_COLORS: Record<string, string> = {
  'FDA Decision': '#ef4444',
  'FDA Approval': '#dc2626',
  'PDUFA Date': '#be123c',
  'Phase 3 Readout': '#3b82f6',
  'Phase 3': '#3b82f6',
  'Clinical Trial': '#a855f7',
  'Earnings': '#10b981',
  'Partnership': '#f59e0b',
};

interface Props {
  data?: HistoryResponse;
  loading: boolean;
  catalysts: Catalyst[];
  period: Period;
  onPeriodChange: (p: Period) => void;
}

export function PriceHistoryChart({ data, loading, catalysts, period, onPeriodChange }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h3 className="mb-4 text-lg">Price History <InfoTooltip text={HELP.stockDetail.price_history} position="bottom" /></h3>
        <div className="h-80 animate-pulse rounded-md border border-border bg-bg/50" />
      </div>
    );
  }

  const bars = data?.history || [];
  const chartData = bars
    .filter((b) => b.close != null)
    .map((b) => ({
      date: b.date,
      close: b.close,
      volume: b.volume,
    }));

  // Compute moving averages
  const withMA = useMemo(() => {
    if (chartData.length === 0) return [];
    return chartData.map((d, i) => {
      const slice50 = chartData.slice(Math.max(0, i - 49), i + 1);
      const slice200 = chartData.slice(Math.max(0, i - 199), i + 1);
      const ma50 = slice50.length >= 50 ? slice50.reduce((s, x) => s + (x.close || 0), 0) / slice50.length : null;
      const ma200 = slice200.length >= 200 ? slice200.reduce((s, x) => s + (x.close || 0), 0) / slice200.length : null;
      return { ...d, ma50, ma200 };
    });
  }, [chartData]);

  // Find 52w high/low (last 252 bars)
  const { hi52, lo52 } = useMemo(() => {
    const recent = chartData.slice(-252);
    if (recent.length === 0) return { hi52: null, lo52: null };
    return {
      hi52: Math.max(...recent.map((d) => d.close || 0)),
      lo52: Math.min(...recent.filter((d) => (d.close || 0) > 0).map((d) => d.close || Infinity)),
    };
  }, [chartData]);

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg">Price History <InfoTooltip text={HELP.stockDetail.price_history} position="bottom" /></h3>
        <div className="flex gap-1 rounded-md border border-border bg-bg/50 p-0.5 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-2 py-1 rounded ${period === p ? 'bg-accent text-black font-medium' : 'text-neutral-400 hover:text-neutral-100'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-sm text-neutral-500">No price history available.</div>
      ) : (
        <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={withMA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  stroke="#737373"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d) => d.slice(5)}
                  minTickGap={50}
                />
                <YAxis
                  stroke="#737373"
                  tick={{ fontSize: 11 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#121212', border: '1px solid #1f1f1f', fontSize: 12 }}
                  labelStyle={{ color: '#a3a3a3' }}
                  formatter={(v: number, name: string) => [`$${Number(v).toFixed(2)}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />

                <Line type="monotone" dataKey="close" stroke="#10b981" strokeWidth={2} dot={false} name="Close" />
                <Line type="monotone" dataKey="ma50" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" dot={false} name="50d MA" />
                <Line type="monotone" dataKey="ma200" stroke="#a855f7" strokeWidth={1} strokeDasharray="5 5" dot={false} name="200d MA" />

                {hi52 != null && (
                  <ReferenceLine
                    y={hi52}
                    stroke="#10b981"
                    strokeDasharray="2 4"
                    strokeWidth={1}
                    label={{ value: `52w High $${hi52.toFixed(2)}`, position: 'right', fill: '#10b981', fontSize: 10 }}
                  />
                )}
                {lo52 != null && lo52 < Infinity && (
                  <ReferenceLine
                    y={lo52}
                    stroke="#ef4444"
                    strokeDasharray="2 4"
                    strokeWidth={1}
                    label={{ value: `52w Low $${lo52.toFixed(2)}`, position: 'right', fill: '#ef4444', fontSize: 10 }}
                  />
                )}

                {/* Catalyst markers */}
                {catalysts.map((c, i) => {
                  const inRange = withMA.find((d) => d.date === c.date);
                  const color = CATALYST_COLORS[c.type] || '#737373';
                  return (
                    <ReferenceLine
                      key={`${c.type}-${c.date}-${i}`}
                      x={c.date}
                      stroke={color}
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      label={{ value: c.type, angle: 0, position: 'top', fill: color, fontSize: 9 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Catalyst legend row */}
          {catalysts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {[...new Set(catalysts.map((c) => c.type))].map((t) => (
                <span key={t} className="flex items-center gap-1 text-neutral-500">
                  <span
                    className="inline-block h-0.5 w-3"
                    style={{ backgroundColor: CATALYST_COLORS[t] || '#737373' }}
                  />
                  {t}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
