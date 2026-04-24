'use client';

import type { SocialData } from '@/lib/api';

export function SocialPanel({ data, loading }: { data?: SocialData; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-3">Social Sentiment</h2>
        <div className="h-28 animate-pulse rounded-md border border-border bg-bg/50" />
      </div>
    );
  }

  const d = (data?.data ?? {}) as Record<string, unknown>;
  const hasData = data?.data && Object.keys(d).length > 0;

  const stocktwitsBullish = (d.stocktwits_bullish_pct as number | undefined)
    ?? ((d.stocktwits as Record<string, unknown> | undefined)?.bullish_pct as number | undefined);
  const stocktwitsMsgs = (d.stocktwits_message_count as number | undefined)
    ?? ((d.stocktwits as Record<string, unknown> | undefined)?.message_count as number | undefined);
  const redditMentions = (d.reddit_mentions as number | undefined)
    ?? ((d.reddit as Record<string, unknown> | undefined)?.mentions as number | undefined);
  const redditSentiment = (d.reddit_sentiment as number | undefined)
    ?? ((d.reddit as Record<string, unknown> | undefined)?.sentiment as number | undefined);

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2>Social Sentiment</h2>
        {data?.error && <span className="text-xs text-red-400">error</span>}
      </div>

      {!hasData || data?.error ? (
        <p className="text-sm text-neutral-500">
          {data?.error ? data.error.slice(0, 120) : 'No social data available.'}
        </p>
      ) : (
        <div className="space-y-3">
          {stocktwitsBullish != null && (
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-neutral-500">StockTwits bullish</span>
                <span className={`text-lg font-semibold ${stocktwitsBullish > 0.6 ? 'text-emerald-400' : stocktwitsBullish < 0.4 ? 'text-red-400' : 'text-neutral-300'}`}>
                  {(stocktwitsBullish * 100).toFixed(0)}%
                </span>
              </div>
              {stocktwitsMsgs != null && (
                <div className="text-xs text-neutral-500">{stocktwitsMsgs} messages</div>
              )}
            </div>
          )}
          {redditMentions != null && (
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-neutral-500">Reddit mentions</span>
                <span className="text-lg font-semibold">{redditMentions}</span>
              </div>
              {redditSentiment != null && (
                <div className="text-xs text-neutral-500">Sentiment: {redditSentiment.toFixed(2)}</div>
              )}
            </div>
          )}
          {/* Raw dump for fields we didn't normalize */}
          {stocktwitsBullish == null && redditMentions == null && (
            <pre className="max-h-48 overflow-auto text-xs text-neutral-400 font-mono">
              {JSON.stringify(d, null, 2).slice(0, 1000)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
