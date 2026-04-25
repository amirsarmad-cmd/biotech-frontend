'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { checkShortlist, addToShortlist, removeFromShortlist } from '@/lib/api';

interface Props {
  ticker: string;
  companyName: string;
  currentPrice: number | null;
  catalyst: { type: string; date: string; probability: number };
  overallScore?: number;
}

export function WatchlistButton({ ticker, companyName, currentPrice, catalyst, overallScore }: Props) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['shortlist-check', ticker],
    queryFn: () => checkShortlist(ticker),
    staleTime: 60_000,
  });

  const add = useMutation({
    mutationFn: () => addToShortlist({
      ticker,
      company_name: companyName,
      initial_price: currentPrice ?? 0,
      catalyst_type: catalyst.type,
      catalyst_date: catalyst.date,
      initial_probability: catalyst.probability,
      initial_score: overallScore ?? 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shortlist-check', ticker] });
      qc.invalidateQueries({ queryKey: ['shortlist'] });
    },
  });

  const remove = useMutation({
    mutationFn: () => removeFromShortlist(ticker),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shortlist-check', ticker] });
      qc.invalidateQueries({ queryKey: ['shortlist'] });
    },
  });

  const isOn = status.data?.shortlisted ?? false;
  const busy = add.isPending || remove.isPending;

  const handleClick = () => {
    if (busy) return;
    if (isOn) remove.mutate();
    else add.mutate();
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy || status.isLoading}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition ${
        isOn
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
          : 'border-border bg-bg/50 text-neutral-300 hover:border-amber-500/30 hover:text-amber-300'
      } ${busy ? 'opacity-60' : ''}`}
      title={isOn ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      <Star className={`h-4 w-4 ${isOn ? 'fill-amber-400 text-amber-400' : ''}`} />
      {isOn ? 'On watchlist' : 'Watchlist'}
    </button>
  );
}
