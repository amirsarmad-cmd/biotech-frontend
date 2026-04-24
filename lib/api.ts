/**
 * Typed API client for biotech-api.
 * Base URL from env (set at build by Railway).
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

export interface NPVBreakdown {
  current?: number;
  approval?: number;
  rejection?: number;
  expected?: number;
  upside_pct?: number;
  downside_pct?: number;
  expected_pct?: number;
  peak_sales_b?: number;
  peak_sales_rationale?: string;
  multiple?: number;
  multiple_rationale?: string;
  drug_npv_m?: number;
  risk_discount_pct?: number;
  risk_factor_breakdown?: Record<string, unknown>;
  market_cap_m?: number;
  fundamental_impact_pct?: number;
  p_approval?: number;
  p_commercial?: number;
  combined_prob?: number;
  baseline_price?: number;
  error?: string;
}

export interface Economics {
  peak_sales_usd_b?: number;
  peak_sales_year?: number;
  peak_sales_rationale?: string;
  multiple?: number;
  multiple_rationale?: string;
  commercial_success_prob?: number;
  commercial_success_rationale?: string;
  first_in_class?: boolean;
  competitive_intensity?: string;
  _llm_provider?: string;
  error?: string | null;
}

export interface StockDetail {
  ticker: string;
  company_name: string;
  industry: string;
  current_price: number | null;
  market_cap_m: number;
  primary_catalyst: Catalyst;
  all_catalysts: Catalyst[];
  npv: { economics?: Economics; npv?: NPVBreakdown; error?: string } | NPVBreakdown | null;
  scores: {
    overall: number;
    sentiment: number;
    news_count: number;
  };
  last_updated: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  date: string;
  summary: string;
  provider?: string;
  sentiment?: number | null;
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

// ─── Fetchers ───────────────────────────────────────────────────────────

async function apiGet<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  return apiGet<StockListResponse>(`/stocks${qs ? `?${qs}` : ''}`);
}

export async function getStockDetail(ticker: string, withNpv = true): Promise<StockDetail> {
  return apiGet<StockDetail>(`/stocks/${encodeURIComponent(ticker)}?with_npv=${withNpv}`);
}

export async function getStockNews(ticker: string, limit = 20): Promise<NewsResponse> {
  return apiGet<NewsResponse>(`/stocks/${encodeURIComponent(ticker)}/news?limit=${limit}`);
}

export async function getStockAnalyst(ticker: string): Promise<AnalystData> {
  return apiGet<AnalystData>(`/stocks/${encodeURIComponent(ticker)}/analyst`);
}

export async function getStockSocial(ticker: string): Promise<SocialData> {
  return apiGet<SocialData>(`/stocks/${encodeURIComponent(ticker)}/social`);
}

export async function getStrategies(
  ticker: string,
  opts: { ai_prob?: number; days_to_catalyst?: number } = {}
): Promise<unknown> {
  const params = new URLSearchParams();
  if (opts.ai_prob != null) params.set('ai_prob', String(opts.ai_prob));
  if (opts.days_to_catalyst != null) params.set('days_to_catalyst', String(opts.days_to_catalyst));
  const qs = params.toString();
  return apiGet(`/strategies/${encodeURIComponent(ticker)}${qs ? `?${qs}` : ''}`);
}

export async function health(): Promise<{ status: string; db: string; redis: string }> {
  return apiGet('/health');
}
