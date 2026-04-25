/**
 * Typed API client for biotech-api.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL
  || 'https://biotech-api-production-7ec4.up.railway.app';

// ─── Types ──────────────────────────────────────────────────────────────

export interface Catalyst {
  type: string;
  date: string;
  probability: number;
  description: string;
}

export interface Stock {
  id: number;
  ticker: string;
  company_name: string;
  industry: string;
  market_cap: number;
  catalyst_type: string;
  catalyst_date: string;
  probability: number;
  description: string;
  news_count: number;
  sentiment_score: number;
  overall_score: number;
  last_updated: string;
}

export interface StockListResponse {
  count: number;
  universe_size: number;
  high_prob_count: number;
  stocks: Stock[];
}

export interface RiskFactor {
  value?: number;
  rationale?: string;
}

export interface NPVFull {
  current?: number;
  approval?: number;
  rejection?: number;
  expected?: number;
  upside_pct?: number;
  downside_pct?: number;
  expected_pct?: number;

  peak_sales_b?: number;
  peak_sales_rationale?: string;
  peak_sales_year?: number;
  multiple?: number;
  multiple_rationale?: string;
  raw_drug_npv_m?: number;
  drug_npv_m?: number;
  risk_discount_pct?: number;
  risk_factor_breakdown?: Record<string, unknown>;
  market_cap_m?: number;
  fundamental_impact_pct?: number;
  full_approval_pct_theoretical?: number;

  p_approval?: number;
  p_commercial?: number;
  commercial_rationale?: string;
  combined_prob?: number;

  baseline_price?: number;
  baseline_days?: number;
  implied_move_pct?: number;

  sentiment_adj_factor?: number;
  sentiment_notes?: string[];

  ai_error?: string;
  first_in_class?: boolean;
  competitive_intensity?: string;

  _economics?: Record<string, unknown>;
  _catalyst_info?: { catalyst_type?: string; catalyst_date?: string; description?: string };

  status?: string;
  reason?: string;
  error?: string;
}

export interface StockDetail {
  ticker: string;
  company_name: string;
  industry: string;
  current_price: number | null;
  market_cap_m: number;
  primary_catalyst: Catalyst;
  npv_catalyst?: Catalyst | null;
  all_catalysts: Catalyst[];
  npv: NPVFull | null;
  scores: {
    overall: number;
    sentiment: number;
    news_count: number;
  };
  last_updated: string;
}

export interface Fundamentals {
  ticker: string;
  key: {
    market_cap: number;
    short_pct_of_float: number;
    pe_trailing: number;
    pe_forward: number;
    cash: number;
    revenue_ttm: number;
    employees: number;
    current_price: number;
  };
  ownership: {
    institutional_pct: number;
    insider_pct: number;
    float_shares: number;
    shares_outstanding: number;
  };
  technicals: {
    week_52_high: number;
    week_52_low: number;
    week_52_position_pct: number | null;
    beta: number | null;
    ma_200: number;
    ma_50: number;
  };
  activity: {
    avg_volume_3m: number;
    avg_volume_10d: number;
    short_ratio: number | null;
    short_pct_float: number;
  };
  financial_health: {
    cash: number;
    debt: number;
    revenue_ttm: number;
    runway_months: number | null;
  };
  summary: string;
}

export interface HistoryBar {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}
export interface HistoryResponse {
  ticker: string;
  period: string;
  count: number;
  history: HistoryBar[];
}

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  date: string;
  summary: string;
  provider?: string;
  sentiment?: number | string | null;
}
export interface NewsResponse {
  ticker: string;
  count: number;
  articles: NewsArticle[];
}

export interface AnalystData {
  ticker: string;
  data: Record<string, unknown> | null;
  error?: string;
}
export interface SocialData {
  ticker: string;
  data: Record<string, unknown> | null;
  error?: string;
}

export interface JobResponse {
  job_id: string;
  poll_url: string;
}
export interface JobStatus {
  job_id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | string;
  created?: number;
  started?: number | null;
  completed?: number | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

// ─── Fetchers ───────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export async function listStocks(opts: {
  high_prob_only?: boolean;
  min_probability?: number;
  limit?: number;
  sort?: 'overall_score' | 'probability' | 'market_cap' | 'ticker';
} = {}): Promise<StockListResponse> {
  const params = new URLSearchParams();
  if (opts.high_prob_only) params.set('high_prob_only', 'true');
  if (opts.min_probability != null) params.set('min_probability', String(opts.min_probability));
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.sort) params.set('sort', opts.sort);
  const qs = params.toString();
  return apiFetch(`/stocks${qs ? `?${qs}` : ''}`);
}

export async function getStockDetail(ticker: string, withNpv = true): Promise<StockDetail> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}?with_npv=${withNpv}`);
}

export async function getStockNews(ticker: string, limit = 20): Promise<NewsResponse> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/news?limit=${limit}`);
}

export async function getStockAnalyst(ticker: string): Promise<AnalystData> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/analyst`);
}

export async function getStockSocial(ticker: string): Promise<SocialData> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/social`);
}

export async function getFundamentals(ticker: string): Promise<Fundamentals> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/fundamentals`);
}

export async function getHistory(ticker: string, period = '2y'): Promise<HistoryResponse> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/history?period=${period}`);
}

export async function getStrategies(
  ticker: string,
  opts: { ai_prob?: number; days_to_catalyst?: number } = {}
): Promise<unknown> {
  const params = new URLSearchParams();
  if (opts.ai_prob != null) params.set('ai_prob', String(opts.ai_prob));
  if (opts.days_to_catalyst != null) params.set('days_to_catalyst', String(opts.days_to_catalyst));
  const qs = params.toString();
  return apiFetch(`/strategies/${encodeURIComponent(ticker)}${qs ? `?${qs}` : ''}`);
}

export async function startNewsImpact(payload: Record<string, unknown>): Promise<JobResponse> {
  return apiFetch('/analyze/news-impact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
export async function startConsensus(payload: Record<string, unknown>): Promise<JobResponse> {
  return apiFetch('/analyze/consensus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
export async function getJob(jobId: string): Promise<JobStatus> {
  return apiFetch(`/jobs/${encodeURIComponent(jobId)}`);
}

export async function health(): Promise<{ status: string; db: string; redis: string }> {
  return apiFetch('/health');
}


// ─── Shortlist (watchlist) ───────────────────────────────────────────────

export interface ShortlistItem {
  ticker: string;
  company_name: string;
  date_added?: string;
  initial_price?: number;
  initial_score?: number;
  notes?: string;
  // Enriched fields from stocks universe (current snapshot)
  catalyst_type?: string;
  catalyst_date?: string;
  current_probability?: number;
  current_score?: number;
  market_cap?: number;
  industry?: string;
}

export interface ShortlistResponse {
  count: number;
  items: ShortlistItem[];
}

export async function getShortlist(): Promise<ShortlistResponse> {
  return apiFetch('/shortlist');
}

export async function addToShortlist(payload: {
  ticker: string;
  company_name?: string;
  initial_price?: number;
  catalyst_type?: string;
  catalyst_date?: string;
  initial_probability?: number;
  initial_score?: number;
  notes?: string;
}): Promise<{ ticker: string; added: boolean }> {
  return apiFetch('/shortlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function removeFromShortlist(ticker: string): Promise<{ ticker: string; removed: boolean }> {
  return apiFetch(`/shortlist/${encodeURIComponent(ticker)}`, { method: 'DELETE' });
}

export async function checkShortlist(ticker: string): Promise<{ ticker: string; shortlisted: boolean }> {
  return apiFetch(`/shortlist/${encodeURIComponent(ticker)}/check`);
}
