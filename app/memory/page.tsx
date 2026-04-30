import { Archive, BookOpen, Clock, FileText, GitBranch } from 'lucide-react';
import { getMemoryArchive } from '@/lib/memory-archive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function MemoryPage() {
  const archive = getMemoryArchive();
  const totalEntries = archive.sections.reduce((sum, section) => sum + section.entries.length, 0);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase text-neutral-500">
              <Archive className="h-3.5 w-3.5" />
              Agent Memory
            </div>
            <h1 className="text-2xl font-semibold tracking-normal text-neutral-100">Project Archive</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
              Git-backed continuity for Codex, Claude Code, design decisions, and deployment history.
            </p>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-border bg-panel p-3">
              <div className="flex items-center gap-2 text-neutral-500">
                <FileText className="h-4 w-4" />
                Entries
              </div>
              <div className="mt-2 text-xl font-semibold text-neutral-100">{totalEntries}</div>
            </div>
            <div className="rounded-lg border border-border bg-panel p-3">
              <div className="flex items-center gap-2 text-neutral-500">
                <GitBranch className="h-4 w-4" />
                Source
              </div>
              <div className="mt-2 text-xl font-semibold text-neutral-100">Git</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-200">
            <BookOpen className="h-4 w-4 text-accent" />
            Current State
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Clock className="h-3.5 w-3.5" />
            {archive.generatedAt}
          </div>
        </div>
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap px-4 py-4 text-xs leading-6 text-neutral-300">
          {archive.currentState || 'No current state recorded yet.'}
        </pre>
      </section>

      <section className="space-y-6">
        {archive.sections.map((section) => (
          <div key={section.title} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-neutral-100">{section.title}</h2>
                <p className="text-sm text-neutral-500">{section.description}</p>
              </div>
              <span className="text-xs text-neutral-500">{section.entries.length} records</span>
            </div>

            {section.entries.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {section.entries.map((entry) => (
                  <article key={entry.path} className="rounded-lg border border-border bg-panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold tracking-normal text-neutral-100">{entry.title}</h3>
                      <span className="shrink-0 text-xs text-neutral-500">{entry.date}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-neutral-400">{entry.excerpt || 'No excerpt.'}</p>
                    <code className="mt-3 block truncate rounded border border-border bg-bg px-2 py-1 text-xs text-neutral-500">
                      {entry.path}
                    </code>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-panel px-4 py-5 text-sm text-neutral-500">
                No records yet.
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

