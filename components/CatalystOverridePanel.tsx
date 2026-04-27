'use client';

/**
 * CatalystOverridePanel — manual catalyst entry + ingestion health
 *
 * Implements the user-approved improvement_proposal:
 *   "Build a simple admin form allowing manual catalyst entry that
 *    overrides auto-parsed data. Display parse health status on detail
 *    page. A screener that can't identify upcoming binary events has
 *    no edge over a random stock picker."
 *
 * Two pieces:
 *   1. <CatalystFreshnessBadge /> — small inline badge showing source +
 *      hours-since-refresh. Renders red when stale (>24h) or no data.
 *      Click → opens the override modal.
 *   2. <CatalystOverrideModal /> — form with all catalyst fields. POSTs
 *      to /admin/catalysts/manual or PATCH /admin/catalysts/{id}. After
 *      save, sets is_manual_override=TRUE so the seeder won't revert.
 *      Shows the ticker's recent ingestion attempts so user can see why
 *      auto-parsing failed.
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Clock, AlertCircle, X, Save, Loader2, Pencil } from 'lucide-react';
import {
  addManualCatalyst, editCatalyst, getCatalystIngestionLog,
  type CatalystDataHealth, type ManualCatalystPayload,
} from '@/lib/api';


// ────────────────────────────────────────────────────────────
// Freshness badge — inline indicator
// ────────────────────────────────────────────────────────────

interface BadgeProps {
  health: CatalystDataHealth | null | undefined;
  onClickEdit?: () => void;
}

function freshnessTier(hours: number | null): { color: string; bg: string; label: string } {
  if (hours == null) return { color: 'text-neutral-500', bg: 'bg-neutral-700/30', label: 'no data' };
  if (hours < 6) return { color: 'text-emerald-300', bg: 'bg-emerald-500/15', label: 'fresh' };
  if (hours < 24) return { color: 'text-amber-300', bg: 'bg-amber-500/15', label: 'recent' };
  if (hours < 24 * 7) return { color: 'text-orange-300', bg: 'bg-orange-500/15', label: 'stale' };
  return { color: 'text-red-300', bg: 'bg-red-500/15', label: 'very stale' };
}

function fmtFreshness(hours: number | null): string {
  if (hours == null) return 'unknown';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours.toFixed(0)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${days.toFixed(0)}d ago`;
  return `${(days / 30).toFixed(0)}mo ago`;
}

function sourceLabel(src: string | null | undefined): string {
  if (!src) return 'unknown';
  // Strip llm_ prefix and clean up
  const s = src.replace(/^llm_/, '').toLowerCase();
  if (s === 'manual') return 'Manual override';
  if (s.startsWith('gemini')) return 'Gemini';
  if (s.startsWith('openai')) return 'GPT-4o';
  if (s.startsWith('anthropic')) return 'Claude (web)';
  if (s.includes('clinicaltrials')) return 'ClinicalTrials.gov';
  return src;
}

export function CatalystFreshnessBadge({ health, onClickEdit }: BadgeProps) {
  if (!health) {
    return (
      <button
        onClick={onClickEdit}
        className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300 hover:border-red-500/60 transition-colors"
        title="No catalyst data — click to add manually"
      >
        <AlertCircle className="h-3 w-3" />
        no data · add catalyst
      </button>
    );
  }
  const tier = freshnessTier(health.freshness_hours);
  const isManual = health.is_manual_override;

  return (
    <button
      onClick={onClickEdit}
      className={`group inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] transition-colors ${tier.bg} ${tier.color} border-transparent hover:border-current/30`}
      title={`Source: ${sourceLabel(health.source)} · ${fmtFreshness(health.freshness_hours)} · click to edit`}
    >
      {isManual ? <ShieldCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      <span>{isManual ? 'Manual override' : sourceLabel(health.source)}</span>
      <span className="text-neutral-500">·</span>
      <span>{fmtFreshness(health.freshness_hours)}</span>
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}


// ────────────────────────────────────────────────────────────
// Override modal — form for manual catalyst entry
// ────────────────────────────────────────────────────────────

interface ModalProps {
  ticker: string;
  open: boolean;
  onClose: () => void;
  // If editing existing, pass the catalyst data + id; null/undefined for new
  existing?: {
    id: number | null;
    type: string;
    date: string;
    drug_name?: string;
    indication?: string;
    phase?: string;
    description?: string;
    probability?: number;
  };
}

const CATALYST_TYPES = [
  'FDA Decision',
  'Phase 3 Readout',
  'Phase 2 Readout',
  'Phase 1 Readout',
  'PDUFA',
  'Clinical Trial',
  'AdCom',
  'Earnings',
  'Other',
];

const PHASES = ['Phase 1', 'Phase 2', 'Phase 3', 'Filed', 'Approved', 'Other'];

export function CatalystOverrideModal({ ticker, open, onClose, existing }: ModalProps) {
  const qc = useQueryClient();
  const isEdit = !!existing?.id;

  const [type, setType] = useState(existing?.type || 'FDA Decision');
  const [date, setDate] = useState(existing?.date || '');
  const [drugName, setDrugName] = useState(existing?.drug_name || '');
  const [indication, setIndication] = useState(existing?.indication || '');
  const [phase, setPhase] = useState(existing?.phase || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [probability, setProbability] = useState<string>(
    existing?.probability != null ? String(existing.probability) : '0.5'
  );
  const [sourceUrl, setSourceUrl] = useState('');

  // Reload existing when it changes
  useEffect(() => {
    if (existing) {
      setType(existing.type || 'FDA Decision');
      setDate(existing.date || '');
      setDrugName(existing.drug_name || '');
      setIndication(existing.indication || '');
      setPhase(existing.phase || '');
      setDescription(existing.description || '');
      setProbability(existing.probability != null ? String(existing.probability) : '0.5');
    }
  }, [existing]);

  // Show recent ingestion attempts so user can see why auto-parsing failed
  const logQ = useQuery({
    queryKey: ['catalyst-ingestion-log', ticker],
    queryFn: () => getCatalystIngestionLog(ticker, 8),
    enabled: open,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: ManualCatalystPayload = {
        ticker,
        catalyst_type: type,
        catalyst_date: date,
        drug_name: drugName || null,
        indication: indication || null,
        phase: phase || null,
        description: description || null,
        probability: probability ? parseFloat(probability) : null,
        source_url: sourceUrl || null,
      };
      if (isEdit && existing?.id) {
        return editCatalyst(existing.id, payload);
      }
      return addManualCatalyst(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock', ticker] });
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3 sticky top-0 bg-panel">
          <div>
            <h2 className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              {isEdit ? 'Override' : 'Add'} catalyst for {ticker}
            </h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Manual entries override auto-parsed data and won&apos;t be reverted by the seeder.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:text-neutral-100 hover:bg-bg-card"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Catalyst type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded border border-border bg-bg-card px-2 py-1.5 text-sm"
              >
                {CATALYST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Date" hint="YYYY-MM-DD">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded border border-border bg-bg-card px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Drug name" hint="e.g. lonvoguran ziclumeran">
              <input
                type="text"
                value={drugName}
                onChange={(e) => setDrugName(e.target.value)}
                className="w-full rounded border border-border bg-bg-card px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Phase">
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="w-full rounded border border-border bg-bg-card px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Indication" hint="e.g. Hereditary Angioedema (HAE)">
              <input
                type="text"
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                className="w-full rounded border border-border bg-bg-card px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Probability of success" hint="0.0 – 1.0">
              <input
                type="number"
                step="0.05" min="0" max="1"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                className="w-full rounded border border-border bg-bg-card px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Source URL" hint="optional press release / clinicaltrials.gov link" full>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://clinicaltrials.gov/study/NCT..."
                className="w-full rounded border border-border bg-bg-card px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Description" full>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-border bg-bg-card px-2 py-1.5 text-sm resize-none"
              />
            </Field>
          </div>

          {/* Recent ingestion attempts */}
          <div className="rounded border border-border bg-bg-card/40 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-500">
              <Clock className="h-3 w-3" />
              Recent ingestion attempts
            </div>
            {logQ.isLoading && (
              <div className="text-[11px] text-neutral-500">loading…</div>
            )}
            {logQ.data && logQ.data.attempts.length === 0 && (
              <div className="text-[11px] text-neutral-500">
                No ingestion attempts logged for {ticker} yet. The system will start
                logging on the next seeder run.
              </div>
            )}
            {logQ.data && logQ.data.attempts.length > 0 && (
              <div className="space-y-1">
                {logQ.data.attempts.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="text-neutral-500 font-mono w-32 shrink-0">
                      {a.attempt_at}
                    </span>
                    <span className="text-neutral-400 w-20 shrink-0">{a.source}</span>
                    <span className={`w-16 shrink-0 ${
                      a.status === 'success' ? 'text-emerald-300' :
                        a.status === 'rate_limited' ? 'text-amber-300' :
                          a.status === 'no_data' ? 'text-neutral-400' :
                            'text-red-300'
                    }`}>
                      {a.status}
                    </span>
                    <span className="text-neutral-500 truncate flex-1">
                      {a.error_message || (a.catalysts_found > 0 ? `${a.catalysts_found} found` : '')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mutation error */}
          {saveMutation.isError && (
            <div className="rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-300">
              {saveMutation.error instanceof Error ? saveMutation.error.message : String(saveMutation.error)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 sticky bottom-0 bg-panel">
          <button
            onClick={onClose}
            className="rounded border border-border bg-bg-card hover:bg-bg-card/60 px-3 py-1.5 text-sm text-neutral-300"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !type || !date}
            className="flex items-center gap-1.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-700 disabled:cursor-not-allowed px-3 py-1.5 text-sm text-white"
          >
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isEdit ? 'Save override' : 'Add catalyst'}
          </button>
        </div>
      </div>
    </div>
  );
}


function Field({ label, hint, full, children }: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'col-span-1 sm:col-span-2' : ''}>
      <label className="block text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
        {label}
        {hint && <span className="ml-1 normal-case tracking-normal text-neutral-600">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}
