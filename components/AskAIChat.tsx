'use client';

/**
 * AskAIChat — floating "Ask AI" chat anchored to a specific stock's detail page.
 *
 * After the NTLA pushback ("I see 1980% upside but verdict says priced in.
 * Doesn't make sense. Add an Ask AI floating chatbox where I can critique
 * results and have it suggest implementing changes"), this widget gives
 * users an interactive way to interrogate any number on the page.
 *
 * Flow:
 *   1. Click floating button (bottom-right of stock detail page)
 *   2. Panel expands; pre-loaded with starter questions
 *   3. User asks free-form question
 *   4. Backend (/chat/explain) builds full context bundle for the ticker
 *      (rNPV, setup_quality, materiality, fundamentals, options) and calls
 *      Claude Sonnet 4.5 with the user's question
 *   5. Claude responds with explanation. If it thinks a calculation
 *      should change based on user critique, it appends a structured
 *      proposal that we render as "Implement this change" affordance.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Loader2, Lightbulb, ArrowUpRight } from 'lucide-react';
import { chatExplain, type ChatMessage, type ImprovementProposal } from '@/lib/api';

interface Props {
  ticker: string;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  proposal?: ImprovementProposal | null;
}

const STARTER_QUESTIONS = [
  'Why is the upside so high? When does it materialize?',
  'Why does it say "priced in" when there is upside?',
  'Walk me through the setup quality score',
  'Should I trust this verdict?',
];

export function AskAIChat({ ticker }: Props) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset conversation when ticker changes
  useEffect(() => {
    setTurns([]);
    setError(null);
  }, [ticker]);

  // Auto-scroll on new turns
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, loading]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const newTurns: Turn[] = [...turns, { role: 'user', content: trimmed }];
    setTurns(newTurns);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const history: ChatMessage[] = turns.map((t) => ({
        role: t.role,
        content: t.content,
      }));
      const resp = await chatExplain({ ticker, question: trimmed, history });
      setTurns([
        ...newTurns,
        {
          role: 'assistant',
          content: resp.reply,
          proposal: resp.improvement_proposal ?? null,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setTurns(newTurns);  // keep user message visible
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-violet-500 hover:bg-violet-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-violet-500/30 transition-colors"
          title={`Ask AI about ${ticker}`}
        >
          <Sparkles className="h-4 w-4" />
          Ask AI about {ticker}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] rounded-lg border border-border bg-panel shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <div className="text-sm font-medium text-neutral-100">
                Ask AI about {ticker}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-neutral-400 hover:text-neutral-100 hover:bg-bg-card"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Conversation */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {turns.length === 0 && (
              <div className="space-y-3">
                <div className="text-xs text-neutral-400 leading-relaxed">
                  I have full context for {ticker} — rNPV, setup quality, materiality,
                  catalysts, fundamentals. Ask me anything about the numbers, or
                  critique the methodology and I&apos;ll evaluate.
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-neutral-500">
                    Try one of these
                  </div>
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="w-full text-left rounded border border-border bg-bg-card hover:bg-bg-card/60 px-3 py-2 text-xs text-neutral-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div
                key={i}
                className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    t.role === 'user'
                      ? 'bg-violet-500/15 border border-violet-500/30 text-neutral-100'
                      : 'bg-bg-card border border-border text-neutral-200'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{t.content}</div>
                  {/* Improvement proposal — render as call-to-action card */}
                  {t.proposal && (
                    <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-300" />
                        <div className="text-[10px] uppercase tracking-wide text-amber-300 font-medium">
                          Suggested system change · confidence {t.proposal.confidence}
                        </div>
                      </div>
                      <div className="text-xs font-medium text-neutral-100">
                        {t.proposal.title}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        Target: {t.proposal.target}
                      </div>
                      <div className="text-xs text-neutral-300 leading-snug">
                        <span className="text-neutral-500">Why:</span> {t.proposal.rationale}
                      </div>
                      <div className="text-xs text-neutral-300 leading-snug">
                        <span className="text-neutral-500">Change:</span> {t.proposal.change_summary}
                      </div>
                      <div className="text-[10px] text-neutral-500 italic">
                        Copy this proposal to your developer to apply. Manual review
                        recommended before deploying.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-border bg-bg-card px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={loading}
                placeholder={`Ask anything about ${ticker}…`}
                rows={1}
                className="flex-1 resize-none rounded border border-border bg-bg-card px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-violet-500/60 focus:outline-none disabled:opacity-50"
                style={{ minHeight: '36px', maxHeight: '120px' }}
              />
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="rounded bg-violet-500 hover:bg-violet-400 disabled:bg-neutral-700 disabled:cursor-not-allowed px-3 py-2 text-white transition-colors"
                title="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-neutral-500">
              Claude Sonnet 4.5 · Has full context for {ticker} · Press Enter to send
            </div>
          </div>
        </div>
      )}
    </>
  );
}
