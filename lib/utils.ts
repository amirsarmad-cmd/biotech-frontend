import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined, decimals = 2): string {
  if (value == null || !isFinite(value)) return '—';
  return `$${value.toFixed(decimals)}`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || !isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatMarketCap(millions: number | null | undefined): string {
  if (millions == null || !isFinite(millions)) return '—';
  if (millions >= 1000) return `$${(millions / 1000).toFixed(2)}B`;
  return `$${millions.toFixed(0)}M`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try {
    const target = new Date(dateStr).getTime();
    const now = Date.now();
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export function catalystColor(type: string | null | undefined): string {
  if (!type) return 'text-neutral-400';
  const t = type.toLowerCase();
  if (t.includes('fda')) return 'text-emerald-400';
  if (t.includes('phase 3')) return 'text-blue-400';
  if (t.includes('earnings')) return 'text-amber-400';
  if (t.includes('clinical')) return 'text-purple-400';
  return 'text-neutral-300';
}

export function probColor(p: number | null | undefined): string {
  if (p == null) return 'text-neutral-400';
  if (p >= 0.75) return 'text-emerald-400';
  if (p >= 0.6) return 'text-lime-400';
  if (p >= 0.45) return 'text-amber-400';
  return 'text-red-400';
}

/** Strip HTML tags — API returns some titles with <a> wrappers */
export function stripTags(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}
