'use client';

import { FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import type { DilutionCapacity } from '@/lib/api';
import { InfoTooltip } from './tooltips';

interface Props {
  dilutionCapacity?: DilutionCapacity | null;
}

const fmtUSD = (v: number | null | undefined) =>
  v == null ? '—' : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B`
    : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
    : v >= 1000 ? `$${(v / 1000).toFixed(0)}K`
    : `$${v.toFixed(0)}`;

const fmtCount = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('en-US');

/**
 * Surfaces dilution capacity hidden in narrative SEC filings (ChatGPT pass-3 #1).
 *
 * For micro-cap biotechs, what matters is not just current shares + debt
 * but the CAPACITY to dilute: ATM facilities, unused shelf, outstanding
 * warrants. These live in S-3 / 424B5 / 8-K narrative, not XBRL.
 *
 * Data is LLM-extracted from actual filing text — every field has a
 * direct quote anchoring it to source.
 */
export function DilutionCapacityPanel({ dilutionCapacity }: Props) {
  if (!dilutionCapacity) return null;
  const dc = dilutionCapacity;
  const hasAnyCapacity =
    dc.atm_facility?.exists ||
    dc.shelf_registration?.exists ||
    (dc.active_warrants?.length || 0) > 0 ||
    (dc.active_convertibles?.length || 0) > 0 ||
    (dc.recent_issuances?.length || 0) > 0;

  if (!hasAnyCapacity && (!dc.warnings || dc.warnings.length === 0)) {
    return (
      <div className="rounded-lg border border-border/50 bg-bg-card p-3">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <FileText className="h-3.5 w-3.5" />
          No active ATM / shelf / warrant disclosures found in last {dc.filings_inspected?.length || 0} SEC filings
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-amber-300" />
        <h3 className="text-sm font-medium text-neutral-200">Dilution capacity (SEC narrative)</h3>
        <InfoTooltip
          text="What the company CAN dilute by, even if it hasn't yet. ATM facilities + unused shelf registration + outstanding warrants. These live in S-3, 424B5, 8-K filings — not XBRL — so they require narrative parsing. Every value is sourced to a specific filing with a direct quote."
          position="bottom"
        />
        {dc.estimated_dilution_capacity_usd != null && (
          <span className="ml-auto text-xs font-mono text-amber-200">
            Est. {fmtUSD(dc.estimated_dilution_capacity_usd)} capacity
          </span>
        )}
      </div>

      {/* ATM + Shelf in 2-card row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {dc.atm_facility?.exists && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-amber-300">ATM facility</div>
            <div className="font-mono text-base text-amber-100">
              {fmtUSD(dc.atm_facility.amount_remaining_usd ?? dc.atm_facility.aggregate_amount_usd)}
              <span className="ml-1 text-[10px] text-neutral-500">
                {dc.atm_facility.amount_remaining_usd != null ? 'remaining' : 'aggregate'}
              </span>
            </div>
            {dc.atm_facility.agent && (
              <div className="text-[10px] text-neutral-500">Agent: {dc.atm_facility.agent}</div>
            )}
            {dc.atm_facility._filing_date && (
              <div className="text-[10px] text-neutral-600">
                {dc.atm_facility._filing_form ?? 'filing'} dated {dc.atm_facility._filing_date}
              </div>
            )}
            {/* Quote anchor — visible by default per ChatGPT pass-3 critique #5 */}
            {dc.atm_facility._quote && (
              <div className="mt-1 rounded-sm border-l-2 border-amber-400/40 bg-bg/40 px-2 py-1.5 text-[10px] italic text-neutral-300 leading-relaxed">
                <span className="text-amber-400/70 not-italic">&ldquo;</span>{dc.atm_facility._quote}<span className="text-amber-400/70 not-italic">&rdquo;</span>
              </div>
            )}
          </div>
        )}

        {dc.shelf_registration?.exists && (
          <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-violet-300">Shelf registration</div>
            <div className="font-mono text-base text-violet-100">
              {fmtUSD(dc.shelf_registration.amount_remaining_usd ?? dc.shelf_registration.aggregate_amount_usd)}
              <span className="ml-1 text-[10px] text-neutral-500">
                {dc.shelf_registration.amount_remaining_usd != null ? 'remaining' : 'authorized'}
              </span>
            </div>
            {dc.shelf_registration.expiration_date && (
              <div className="text-[10px] text-neutral-500">
                Expires {dc.shelf_registration.expiration_date}
              </div>
            )}
            {dc.shelf_registration._filing_date && (
              <div className="text-[10px] text-neutral-600">
                Filed {dc.shelf_registration._filing_date}
              </div>
            )}
            {/* Quote anchor — visible by default */}
            {dc.shelf_registration._quote && (
              <div className="mt-1 rounded-sm border-l-2 border-violet-400/40 bg-bg/40 px-2 py-1.5 text-[10px] italic text-neutral-300 leading-relaxed">
                <span className="text-violet-400/70 not-italic">&ldquo;</span>{dc.shelf_registration._quote}<span className="text-violet-400/70 not-italic">&rdquo;</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Warrants table */}
      {dc.active_warrants && dc.active_warrants.length > 0 && (
        <div className="rounded-md border border-border/50 bg-bg/30 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-neutral-500">
            Outstanding warrants
          </div>
          <div className="space-y-2">
            {dc.active_warrants.slice(0, 5).map((w, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-neutral-300">{fmtCount(w.count)}</span>
                  <span className="text-neutral-500">@</span>
                  <span className="font-mono text-amber-300">${w.exercise_price_usd?.toFixed(2)}</span>
                  {w.expiration_date && (
                    <span className="text-[10px] text-neutral-500">exp {w.expiration_date}</span>
                  )}
                  {w.category && (
                    <span className="text-[10px] text-neutral-600">· {w.category}</span>
                  )}
                </div>
                {w._quote && (
                  <div className="rounded-sm border-l-2 border-neutral-700 bg-bg/40 px-2 py-1 text-[10px] italic text-neutral-400 leading-relaxed">
                    &ldquo;{w._quote}&rdquo;
                  </div>
                )}
              </div>
            ))}
            {dc.active_warrants.length > 5 && (
              <div className="text-[10px] text-neutral-500">
                + {dc.active_warrants.length - 5} more series
              </div>
            )}
          </div>
        </div>
      )}

      {/* Convertibles */}
      {dc.active_convertibles && dc.active_convertibles.length > 0 && (
        <div className="rounded-md border border-border/50 bg-bg/30 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-neutral-500">
            Convertible notes
          </div>
          <div className="space-y-1">
            {dc.active_convertibles.slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-neutral-300">{fmtUSD(c.principal_usd)}</span>
                {c.conversion_price_usd && (
                  <span className="text-neutral-500">conv @ <span className="font-mono text-amber-300">${c.conversion_price_usd}</span></span>
                )}
                {c.interest_rate_pct != null && (
                  <span className="text-[10px] text-neutral-500">{c.interest_rate_pct}%</span>
                )}
                {c.maturity_date && (
                  <span className="text-[10px] text-neutral-600">mat {c.maturity_date}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent issuances */}
      {dc.recent_issuances && dc.recent_issuances.length > 0 && (
        <div className="rounded-md border border-border/50 bg-bg/30 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-neutral-500">
            Recent issuances (last 18mo)
          </div>
          <div className="space-y-1">
            {dc.recent_issuances.slice(0, 3).map((iss, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-neutral-300">{fmtUSD(iss.gross_proceeds_usd)}</span>
                <span className="text-[10px] text-neutral-500">{iss.type}</span>
                {iss.shares_issued && (
                  <span className="text-[10px] text-neutral-500">
                    · {fmtCount(iss.shares_issued)} shares @ ${iss.price_per_share_usd?.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {dc.warnings && dc.warnings.length > 0 && (
        <div className="space-y-1">
          {dc.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-300" />
              <span className="text-amber-100/80">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filings inspected */}
      {dc.filings_inspected && dc.filings_inspected.length > 0 && (
        <details className="text-[10px] text-neutral-500">
          <summary className="cursor-pointer hover:text-neutral-400">
            {dc.filings_inspected.length} filings inspected
          </summary>
          <div className="mt-1 space-y-0.5 pl-4">
            {dc.filings_inspected.map((f, i) => (
              <div key={i} className="flex gap-2">
                <span className="font-mono">{f.filing_date}</span>
                <span className="text-amber-300">{f.form}</span>
                {f.url && (
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                     className="hover:text-violet-300 inline-flex items-center gap-0.5">
                    {f.accession_no.substring(0, 13)}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {f.summary && <span className="truncate">· {f.summary}</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="text-[10px] text-neutral-600">
        Source: SEC EDGAR (S-3 / 424B5 / 8-K narrative) · LLM-extracted with quote anchors
      </div>
    </div>
  );
}
