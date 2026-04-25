'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Trash2, Star } from 'lucide-react';
import { InfoTooltip } from '@/components/tooltips';
import { HELP } from '@/lib/help-text';
import { getShortlist, removeFromShortlist, type ShortlistItem } from '@/lib/api';
import { formatDate, daysUntil, catalystColor, probColor } from '@/lib/utils';

export default function WatchlistPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['shortlist'],
    queryFn: getShortlist,
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: (ticker: string) => removeFromShortlist(ticker),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shortlist'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2"><Star className="h-6 w-6 text-amber-400" /> Watchlist <InfoTooltip text={HELP.watchlist.title} position="bottom" size="md" /></h1>
        {q.data && (
          <span className="text-sm text-neutral-500">{q.data.count} ticker{q.data.count === 1 ? '' : 's'}</span>
        )}
      </div>

      {q.isLoading && (
        <div className="h-40 animate-pulse rounded-lg border border-border bg-panel" />
      )}

      {q.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {(q.error as Error).message}
        </div>
      )}

      {q.data && q.data.count === 0 && (
        <div className="rounded-lg border border-border bg-panel p-8 text-center text-sm text-neutral-500">
          Your watchlist is empty. Open any ticker from the{' '}
          <Link href="/" className="text-accent hover:underline">screener</Link>{' '}
          and click <span className="text-amber-400">★ Add to watchlist</span>.
        </div>
      )}

      {q.data && q.data.count > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg/50">
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Catalyst</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Prob</th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1 justify-end">Initial price<InfoTooltip text={HELP.watchlist.initial_price} position="bottom" /></span></th>
                <th className="px-3 py-2">Added</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((s: ShortlistItem) => (
                <tr key={s.ticker} className="border-t border-border hover:bg-bg/30 transition">
                  <td className="px-3 py-2">
                    <Link href={`/stocks/${s.ticker}`} className="font-mono font-semibold text-neutral-100 hover:text-accent">
                      {s.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-neutral-300">{s.company_name || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={catalystColor(s.catalyst_type || '')}>{s.catalyst_type || '—'}</span>
                  </td>
                  <td className="px-3 py-2 text-neutral-400">
                    {s.catalyst_date ? formatDate(s.catalyst_date) : '—'}
                    {s.catalyst_date && daysUntil(s.catalyst_date) != null && (
                      <span className="ml-2 text-xs text-neutral-600">({daysUntil(s.catalyst_date)}d)</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${probColor(s.current_probability ?? s.initial_probability ?? 0)}`}>
                    {(() => {
                      const p = s.current_probability ?? s.initial_probability;
                      return p != null ? `${(p * 100).toFixed(0)}%` : '—';
                    })()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-400">
                    {s.initial_price ? `$${s.initial_price.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {s.date_added ? formatDate(s.date_added) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remove.mutate(s.ticker)}
                      disabled={remove.isPending && remove.variables === s.ticker}
                      className="text-neutral-500 hover:text-red-400 transition"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
