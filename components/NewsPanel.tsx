'use client';

import { ExternalLink } from 'lucide-react';
import type { NewsResponse } from '@/lib/api';
import { stripTags, formatDate } from '@/lib/utils';

export function NewsPanel({ data, loading }: { data?: NewsResponse; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h2 className="mb-3">News</h2>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md border border-border bg-bg/50" />
          ))}
        </div>
      </div>
    );
  }

  const articles = data?.articles || [];

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2>News</h2>
        <span className="text-xs text-neutral-500">{articles.length} articles · last 30 days</span>
      </div>
      {articles.length === 0 ? (
        <p className="text-sm text-neutral-500">No recent articles.</p>
      ) : (
        <ul className="divide-y divide-border">
          {articles.map((a, i) => (
            <li key={`${a.url}-${i}`} className="py-3">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span className="font-medium text-neutral-400">{a.source || a.provider || '—'}</span>
                      <span>·</span>
                      <span>{a.date}</span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-200 group-hover:text-accent transition">
                      {stripTags(a.title)}
                    </div>
                    {a.summary && (
                      <p className="mt-1 text-xs text-neutral-400 line-clamp-2">{stripTags(a.summary)}</p>
                    )}
                  </div>
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-600 group-hover:text-neutral-400" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
