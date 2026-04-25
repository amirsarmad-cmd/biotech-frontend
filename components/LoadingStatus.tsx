'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, XCircle, Pause, ChevronDown, ChevronUp } from 'lucide-react';

export type LoadStatus = 'queued' | 'loading' | 'success' | 'error' | 'idle';

export type LoadAction = {
  /** unique key */
  key: string;
  /** display label */
  label: string;
  /** current status */
  status: LoadStatus;
  /** when this action started (ms timestamp). Used for elapsed time display. */
  startedAt?: number;
  /** when this action completed */
  completedAt?: number;
  /** error message if failed */
  error?: string;
};

type Props = {
  actions: LoadAction[];
  /** when all actions complete, hide automatically after this many ms (default 3000). null = stay visible. */
  autoHideMs?: number | null;
};

function statusIcon(status: LoadStatus) {
  switch (status) {
    case 'loading': return <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />;
    case 'success': return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    case 'error': return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    case 'queued': return <Pause className="h-3.5 w-3.5 text-neutral-500" />;
    default: return <span className="h-3.5 w-3.5 inline-block" />;
  }
}

function formatElapsed(action: LoadAction): string {
  if (action.status === 'queued' || action.status === 'idle') return '';
  const end = action.completedAt ?? Date.now();
  const start = action.startedAt ?? end;
  const ms = Math.max(0, end - start);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function LoadingStatus({ actions, autoHideMs = 3000 }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const tickRef = useRef(0);
  const [, forceTick] = useState(0);

  // Force re-render every 200ms to update elapsed time on running actions
  useEffect(() => {
    if (hidden) return;
    const anyLoading = actions.some(a => a.status === 'loading');
    if (!anyLoading) return;
    const id = setInterval(() => {
      tickRef.current++;
      forceTick(t => t + 1);
    }, 200);
    return () => clearInterval(id);
  }, [actions, hidden]);

  // Auto-hide once all done
  useEffect(() => {
    if (autoHideMs == null || hidden) return;
    const allSettled = actions.length > 0 && actions.every(a => a.status === 'success' || a.status === 'error' || a.status === 'idle');
    const anyError = actions.some(a => a.status === 'error');
    if (allSettled && !anyError) {
      const id = setTimeout(() => setHidden(true), autoHideMs);
      return () => clearTimeout(id);
    }
  }, [actions, autoHideMs, hidden]);

  if (hidden || actions.length === 0) return null;

  const completed = actions.filter(a => a.status === 'success' || a.status === 'error' || a.status === 'idle').length;
  const errors = actions.filter(a => a.status === 'error').length;
  const total = actions.length;
  const allDone = completed === total;

  return (
    <div className="rounded-md border border-border bg-panel/60 backdrop-blur-sm">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-panel/80 transition"
      >
        <div className="flex items-center gap-2 text-neutral-300">
          {!allDone && <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />}
          {allDone && errors === 0 && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
          {allDone && errors > 0 && <XCircle className="h-3.5 w-3.5 text-red-400" />}
          <span className="font-medium">
            {allDone ? (errors > 0 ? `Loaded with ${errors} error${errors > 1 ? 's' : ''}` : `All loaded`) : `Loading… ${completed} of ${total}`}
          </span>
        </div>
        <span className="text-neutral-500 inline-flex items-center gap-1">
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </span>
      </button>
      {!collapsed && (
        <div className="border-t border-border/50 px-3 py-2">
          <ul className="space-y-1">
            {actions.map(a => (
              <li key={a.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-neutral-300">
                  {statusIcon(a.status)}
                  <span>{a.label}</span>
                  {a.error && <span className="text-red-400/80 italic ml-1 truncate max-w-[200px]" title={a.error}>· {a.error}</span>}
                </span>
                <span className="font-mono text-neutral-500">{formatElapsed(a)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to track a React Query as a LoadAction.
 * 
 * Usage:
 *   const stockQ = useQuery({...});
 *   const stockAction = useQueryAction({key:'stock', label:'Stock detail', query: stockQ});
 */
export function useQueryAction(opts: {
  key: string;
  label: string;
  query: { isPending?: boolean; isLoading?: boolean; isFetching?: boolean; isError?: boolean; isSuccess?: boolean; error?: unknown; dataUpdatedAt?: number; failureCount?: number; status?: string };
}): LoadAction {
  const startRef = useRef<number | null>(null);
  const completeRef = useRef<number | null>(null);
  const lastStatus = useRef<string>('idle');
  const q = opts.query;

  // Detect status transitions
  const isLoading = q.isPending ?? q.isLoading ?? false;
  const isFetching = q.isFetching ?? false;
  const isError = q.isError ?? false;
  const isSuccess = q.isSuccess ?? false;

  const currentStatus: LoadStatus = isError ? 'error' : (isSuccess && !isLoading) ? 'success' : (isLoading || isFetching) ? 'loading' : 'idle';

  // Track when this query started loading
  if (currentStatus === 'loading' && lastStatus.current !== 'loading') {
    startRef.current = Date.now();
    completeRef.current = null;
  }
  if (currentStatus !== 'loading' && lastStatus.current === 'loading') {
    completeRef.current = q.dataUpdatedAt ?? Date.now();
  }
  lastStatus.current = currentStatus;

  return {
    key: opts.key,
    label: opts.label,
    status: currentStatus,
    startedAt: startRef.current ?? undefined,
    completedAt: completeRef.current ?? undefined,
    error: isError ? ((q.error as Error)?.message || 'Failed to load') : undefined,
  };
}
