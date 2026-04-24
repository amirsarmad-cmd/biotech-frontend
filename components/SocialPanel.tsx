'use client';

import type { SocialData } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type SocialMsg = {
  title?: string;
  summary?: string;
  url?: string;
  date?: string;
  sentiment?: string;
  author?: string;
  author_followers?: number;
  likes?: number;
};

type SourceData = {
  messages?: SocialMsg[];
  posts?: SocialMsg[];
  total_messages_24h?: number;
  mentions_7d?: number;
  avg_sentiment?: number;
  bullish_pct?: number;
};

export function SocialPanel({ data, loading }: { data?: SocialData; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-3">Social Sentiment</h2>
        <div className="h-40 animate-pulse rounded-md border border-border bg-bg/50" />
      </div>
    );
  }

  const d = (data?.data ?? {}) as {
    stocktwits?: SourceData;
    reddit?: SourceData;
    combined_sentiment_score?: number;
    total_mentions?: number;
  };
  const hasData = data?.data && Object.keys(d).length > 0;

  if (!hasData || data?.error) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-3">Social Sentiment</h2>
        <p className="text-sm text-neutral-500">
          {data?.error ? data.error.slice(0, 120) : 'No social data available.'}
        </p>
      </div>
    );
  }

  const sentiment = d.combined_sentiment_score;
  const sentimentColor =
    sentiment == null ? 'text-neutral-400'
    : sentiment > 0.3 ? 'text-emerald-400'
    : sentiment < -0.1 ? 'text-red-400'
    : 'text-amber-400';
  const sentimentLabel =
    sentiment == null ? '—'
    : sentiment > 0.3 ? 'Bullish'
    : sentiment > 0 ? 'Slightly bullish'
    : sentiment > -0.1 ? 'Neutral'
    : 'Bearish';

  // Collect top messages
  const allMsgs: Array<SocialMsg & { _src: string }> = [];
  const stMsgs = d.stocktwits?.messages || [];
  const rdPosts = d.reddit?.messages || d.reddit?.posts || [];
  stMsgs.slice(0, 4).forEach((m) => allMsgs.push({ ...m, _src: 'StockTwits' }));
  rdPosts.slice(0, 3).forEach((m) => allMsgs.push({ ...m, _src: 'Reddit' }));

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2>Social Sentiment</h2>
        {d.total_mentions != null && (
          <span className="text-xs text-neutral-500">{d.total_mentions} mentions</span>
        )}
      </div>

      {/* Sentiment + mentions row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-border bg-bg/50 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Sentiment</div>
          <div className={`mt-1 text-2xl font-semibold ${sentimentColor}`}>{sentimentLabel}</div>
          {sentiment != null && (
            <div className="mt-0.5 text-xs text-neutral-500 font-mono">score: {sentiment.toFixed(2)}</div>
          )}
        </div>
        <div className="rounded-md border border-border bg-bg/50 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Activity</div>
          <div className="mt-1 text-sm space-y-0.5 font-mono">
            {d.stocktwits?.total_messages_24h != null && (
              <div className="text-neutral-200">
                <span className="text-neutral-500">StockTwits:</span> {d.stocktwits.total_messages_24h}
              </div>
            )}
            {d.reddit?.mentions_7d != null && (
              <div className="text-neutral-200">
                <span className="text-neutral-500">Reddit:</span> {d.reddit.mentions_7d}
              </div>
            )}
            {!d.stocktwits?.total_messages_24h && !d.reddit?.mentions_7d && (
              <div className="text-neutral-500 text-xs font-sans">No activity breakdown</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent messages */}
      {allMsgs.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Recent posts</div>
          <ul className="space-y-2">
            {allMsgs.slice(0, 5).map((m, i) => (
              <li key={i} className="rounded-md border border-border bg-bg/30 p-3">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="font-medium text-neutral-400">{m._src}</span>
                  {m.sentiment && (
                    <>
                      <span>·</span>
                      <SentimentTag label={m.sentiment} />
                    </>
                  )}
                  {m.author && (
                    <>
                      <span>·</span>
                      <span>@{m.author}</span>
                    </>
                  )}
                  {m.date && (
                    <>
                      <span className="ml-auto">{m.date}</span>
                    </>
                  )}
                </div>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-sm text-neutral-200 hover:text-accent transition"
                >
                  {(m.title || m.summary || '').slice(0, 180)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SentimentTag({ label }: { label: string }) {
  const l = label.toLowerCase();
  const color =
    l.includes('bull') ? 'text-emerald-400'
    : l.includes('bear') ? 'text-red-400'
    : 'text-neutral-400';
  return <span className={color}>{label}</span>;
}
