/**
 * Typed API client for biotech-api.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL
  || 'https://biotech-api-production-7ec4.up.railway.app';

// ─── Types ──────────────────────────────────────────────────────────────

export interface CatalystMateriality {
  score: number;            // 0-1 composite
  tier_score: number;
  tier_label: string;       // 'FDA decision' | 'Phase 3 readout' | etc
  proximity_score: number;
  probability_score: number;
  binary_score: number;
  days_out: string;
  rationale: string;        // human-readable explanation
}

export interface Catalyst {
  type: string;
  date: string;
  probability: number;
  description: string;
  drug_name?: string;
  canonical_drug_name?: string;  // normalized key for grouping multi-asset programs
  indication?: string;
  phase?: string;
  source?: string;
  // Materiality score with explanation — surfaced in DecisionCockpit
  materiality?: CatalystMateriality;
  materiality_score?: number;
  materiality_rationale?: string;
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

export interface SetupQualityAxis {
  score: number | null;        // 0.0 (bad) to 1.0 (good)
  raw: number | null;          // underlying numeric value
  flag: 'green' | 'amber' | 'red' | 'unknown';
  note: string;                // one-sentence explanation
}

export interface SetupQuality {
  score: number | null;
  flag: 'green' | 'amber' | 'red' | 'unknown';
  verdict: string;             // headline e.g. 'Crowded long — sell-the-news risk'
  axes: {
    runup: SetupQualityAxis;
    week52_position: SetupQualityAxis;
    short_interest: SetupQualityAxis;
    iv_euphoria: SetupQualityAxis;
    sentiment: SetupQualityAxis;
    insider_activity: SetupQualityAxis;
  };
  warnings: string[];
  rationale: string;
}

export interface StockDetail {
  ticker: string;
  company_name: string;
  industry: string;
  current_price: number | null;
  market_cap_m: number;
  primary_catalyst: Catalyst;
  npv_catalyst?: Catalyst | null;
  options_implied?: OptionsImplied | null;
  setup_quality?: SetupQuality | null;
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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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

// ---- V2 NPV (Phase 2B): structured economics + true rNPV --------------------
export type ProvenanceSource =
  | 'openfda' | 'clinicaltrials_gov' | 'sec_edgar' | 'orange_book' | 'polygon_options'
  | 'finnhub' | 'llm_grounded_web' | 'llm_inference' | 'user_research';

export interface ProvenanceEntry {
  source: ProvenanceSource;
  confidence: 'high' | 'medium' | 'low';
  citation: string;
}

export interface VerifiedFacts {
  ticker: string;
  drug_name: string;
  indication?: string | null;
  drug_label?: {
    brand_names?: string[];
    generic_names?: string[];
    indications_and_usage?: string;
    boxed_warning?: string | null;
    manufacturer_name?: string[];
  };
  approval_history?: {
    approval_count: number;
    rejection_count: number;
    earliest_approval?: string | null;
    latest_action?: string | null;
    applications?: Array<{ application_number?: string; sponsor_name?: string }>;
  };
  clinical_trials?: {
    total_count: number;
    studies: Array<{
      nct_id?: string;
      brief_title?: string;
      phase?: string;
      status?: string;
      enrollment?: number;
      primary_completion_date?: string;
      _url?: string;
    }>;
  };
  _sources_attempted: string[];
  _sources_succeeded: string[];
  _fetch_duration_ms?: number;
}

export interface DrugEconomicsV2 {
  catalyst_scope?: 'first_approval' | 'new_indication' | 'label_expansion' | 'phase_readout' | 'earnings' | 'other' | string;
  indication?: string;
  modality?: 'small_molecule' | 'biologic' | 'antibody' | 'cell_gene' | 'rna' | 'other' | string;
  first_in_class?: boolean | null;
  addressable_population_us?: number | null;
  addressable_population_global?: number | null;
  annual_cost_min_usd?: number | null;
  annual_cost_max_usd?: number | null;
  // Net realized pricing (post-rebates) — split US vs ex-US
  annual_cost_us_net_usd?: number | null;
  annual_cost_exus_net_usd?: number | null;
  revenue_split_us_pct?: number | null;
  standard_of_care_cost_usd?: number | null;
  penetration_min_pct?: number | null;
  penetration_max_pct?: number | null;
  penetration_mid_pct?: number | null;
  launch_year?: number | null;
  peak_sales_year?: number | null;
  time_to_peak_years?: number | null;
  patent_expiry_date?: string | null;
  loe_dropoff_pct?: number | null;
  cogs_pct_estimate?: number | null;
  commercial_success_prob?: number | null;
  // Methodology audit additions — split probability
  p_event_occurs?: number | null;
  p_positive_outcome?: number | null;
  competitors?: string[];
  competitive_intensity?: 'low' | 'medium' | 'high' | string;
  key_risks?: string[];
  llm_rationale?: string;
  llm_provider?: string;
  peak_sales_usd_b?: number;
  research_context?: string;
  // Provenance & confidence — per-field source tagging
  provenance?: Record<string, ProvenanceEntry>;
  confidence_score?: number | null;  // 0-1 rollup across critical fields
  // Per-category confidence breakdown — ChatGPT pass-4 critique #6
  // For each category, score is 0-1 average over (high=1, med=0.6, low=0.2,
  // missing=0). n_populated/n_fields tells you how complete the data is.
  confidence_breakdown?: {
    clinical?: { score: number; n_fields: number; n_populated: number };
    regulatory?: { score: number; n_fields: number; n_populated: number };
    market?: { score: number; n_fields: number; n_populated: number };
    pricing?: { score: number; n_fields: number; n_populated: number };
    penetration?: { score: number; n_fields: number; n_populated: number };
    dilution?: { score: number; n_fields: number; n_populated: number };
  } | null;
  verified_facts?: VerifiedFacts;     // FDA + CT.gov anchored facts
  _from_cache?: boolean;
  error?: string | null;
}

export interface RnpvForecastRow {
  year: number;
  revenue_m: number;
  ebit_m?: number;
  cash_flow_m: number;
  discount_factor: number;
  pv_m: number;
  penetration_pct: number;
}

export interface RnpvScenario {
  rnpv_m: number;
  peak_sales_usd_b: number;
  penetration_pct: number;
  label: string;
}

export interface RnpvFull {
  rnpv_m: number;
  deterministic_npv_m: number;
  peak_sales_usd_b: number;
  fundamental_impact_pct: number;
  revenue_forecast: RnpvForecastRow[];
  assumptions_used?: Record<string, unknown>;
  error?: string | null;
  // Methodology audit additions
  scenarios?: { bear?: RnpvScenario; base?: RnpvScenario; bull?: RnpvScenario };
  per_share_drug_npv_usd?: number | null;
  per_share_after_dilution_usd?: number | null;
  shares_outstanding_m?: number | null;
  dilution_assumed_pct?: number | null;
  caveats?: string[];
}

export interface OptionsImplied {
  implied_move_pct: number;
  expiry: string;
  atm_strike: number;
  straddle_premium: number;
  stock_price: number;
  days_to_expiry: number;
  source: string;
  annualized_iv_pct?: number | null;
  call_price?: number;
  put_price?: number;
}

export interface ProbabilityResolution {
  p_approval_used: number;
  p_approval_source:
    | 'user_override'
    | 'legacy_alias'
    | 'catalyst_p_positive_outcome'
    | 'catalyst_probability_legacy'
    | string;
  p_commercial_used: number;
  p_event_occurs_used: number | null;
  p_positive_outcome_used: number | null;
  rnpv_method: 'split_probability' | 'combined_p_approval' | string | null;
}

export interface MoveEstimates {
  catalyst_type: string;
  p_approval_used: number;
  expected_value_move_pct: number;
  expected_value_scenario_pct?: number;
  expected_value_used_fundamental_impact?: boolean;
  options_implied_move_pct: number | null;
  scenario_upside_pct: number;
  scenario_downside_pct: number;
  reference_move: {
    up_pct: number;
    down_pct: number;
    calibration_source: string;
  };
  interpretation: string;
  warning: string | null;
}

export interface CapitalStructure {
  ticker: string;
  cik: string;
  as_of_filing: string | null;
  cash_and_equivalents: number;
  short_term_investments: number;
  total_cash: number;
  long_term_debt: number;
  current_debt: number;
  total_debt: number;
  net_debt: number;
  shares_outstanding: number | null;
  quarterly_burn_usd: number | null;
  monthly_burn_usd: number | null;
  cash_runway_months: number | null;
  needs_financing_within_12mo: boolean;
  _source: 'sec_edgar';
  _filings?: Record<string, { tag: string; taxonomy: string; end?: string; filed?: string; form?: string }>;
}

export interface EquityValue {
  rnpv_m: number;
  total_cash_m: number;
  total_debt_m: number;
  net_cash_adjustment_m: number;
  equity_value_pre_dilution_m: number;
  projected_dilution_pct: number;
  projected_raise_m: number;
  dilution_source: 'user_override' | 'runway_projection' | 'none' | string;
  financing_discount_assumed_pct: number;
  equity_value_post_dilution_m: number;
  shares_outstanding_m: number | null;
  per_share_value_usd: number | null;
  monthly_burn_m: number | null;
  cash_runway_months: number | null;
  needs_financing_within_12mo: boolean;
  as_of_filing: string | null;
  warnings: string[];
  _provenance: 'sec_edgar';
}

export interface DilutionWarrant {
  count: number;
  exercise_price_usd: number;
  expiration_date: string | null;
  category: string | null;
  _quote?: string;
  _filing_date?: string;
}

export interface DilutionCapacity {
  ticker: string;
  cik: string;
  filings_inspected: Array<{
    form: string;
    filing_date: string;
    accession_no: string;
    primary_doc?: string;
    summary?: string;
    extraction_quality?: string;
    url?: string;
    _status?: string;
  }>;
  atm_facility: {
    exists: boolean;
    aggregate_amount_usd: number | null;
    amount_remaining_usd: number | null;
    agent?: string;
    established_date?: string;
    _filing_date?: string;
    _filing_form?: string;
    _quote?: string;
  } | null;
  shelf_registration: {
    exists: boolean;
    aggregate_amount_usd: number | null;
    amount_remaining_usd: number | null;
    filed_date?: string;
    expiration_date?: string;
    _filing_date?: string;
    _quote?: string;
  } | null;
  active_warrants: DilutionWarrant[];
  active_convertibles: Array<{
    principal_usd: number;
    conversion_price_usd: number | null;
    maturity_date: string | null;
    interest_rate_pct: number | null;
    _quote?: string;
  }>;
  recent_issuances: Array<{
    shares_issued: number | null;
    price_per_share_usd: number | null;
    gross_proceeds_usd: number | null;
    type: string;
    _quote?: string;
  }>;
  estimated_dilution_capacity_usd: number | null;
  warnings: string[];
  _provenance: 'sec_edgar_narrative';
  _from_cache?: boolean;
}

export interface SourcePrecedenceAudit {
  overrides_applied: Array<{
    field: string;
    from_value: unknown;
    to_value: unknown;
    verified_source: string;
    reason: string;
  }>;
  checks_performed: string[];
  fields_with_no_override: string[];
}

export interface NPVAnalyzeResponse {
  ticker: string;
  drug_name?: string;
  economics?: Record<string, unknown>;       // legacy LLM economics
  npv?: NPVFull & { methodology_notes?: string[] };  // legacy multiple-based NPV + audit notes
  economics_v2?: DrugEconomicsV2;             // structured fields
  rnpv?: RnpvFull;                            // year-by-year DCF
  from_cache?: boolean;
  // Surfaced probability resolution — UI shows which value drove the math
  probability_resolution?: ProbabilityResolution;
  // 4 distinct move types — UI should show all separately, not collapse
  move_estimates?: MoveEstimates | null;
  // Capital-structure-aware equity value (SEC EDGAR balance sheet)
  equity_value?: EquityValue | null;
  capital_structure?: CapitalStructure | null;
  // Narrative dilution: ATM, shelf, warrants from S-3/424B5/8-K
  dilution_capacity?: DilutionCapacity | null;
  // What verified-source values overrode LLM inference
  source_precedence_audit?: SourcePrecedenceAudit | null;
}

export async function analyzeNpv(payload: {
  ticker: string;
  catalyst_type?: string;
  market_cap_m?: number;
  p_approval?: number;     // P(catalyst event resolves favorably) — primary
  p_commercial?: number;   // P(strong commercial uptake | approved) — separate
  discount_rate?: number;
  tax_rate?: number;
  cogs_pct?: number;
  force_refresh?: boolean;
  drug_name_override?: string;
  description_override?: string;
  // Methodology audit additions
  dilution_assumed_pct?: number;
  shares_outstanding_m_override?: number;
}): Promise<NPVAnalyzeResponse> {
  return apiFetch('/analyze/npv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ---- Phase 3B: LLM usage / budgets ----------------------------------------
export interface LlmUsageHeadline {
  today_global_usd: number;
  month_global_usd: number;
  by_provider_today: Record<string, number>;
  by_provider_month: Record<string, number>;
}

export interface LlmUsageSummaryRow {
  day?: string;
  provider?: string;
  feature?: string;
  calls: number;
  cost_usd: number;
  tokens_in?: number;
  tokens_out?: number;
  errors?: number;
}

export interface LlmUsageSummary {
  since: string;
  days: number;
  group_by: string;
  totals: { calls: number; cost_usd: number; tokens_in: number; tokens_out: number };
  today_spend_usd: number;
  month_spend_usd: number;
  rows: LlmUsageSummaryRow[];
}

export interface LlmUsageRow {
  id: number;
  ts: string;
  provider: string;
  model?: string;
  feature?: string;
  ticker?: string;
  tokens_input?: number;
  tokens_output?: number;
  cost_usd?: number;
  duration_ms?: number;
  status: string;
  error_message?: string;
  request_id?: string;
}

export interface LlmBudget {
  id: number;
  scope_type: 'global' | 'provider' | 'feature' | 'provider_feature' | string;
  scope_value: string;
  daily_limit_usd?: number | null;
  monthly_limit_usd?: number | null;
  hard_cutoff: boolean;
  alert_at_pct?: number;
  enabled: boolean;
  notes?: string;
  updated_at?: string;
}

export async function getLlmUsageHeadline(): Promise<LlmUsageHeadline> {
  return apiFetch('/admin/llm/usage/headline');
}
export async function getLlmUsageSummary(days: number, group_by: 'day' | 'provider' | 'feature' | 'day_provider'): Promise<LlmUsageSummary> {
  return apiFetch(`/admin/llm/usage/summary?days=${days}&group_by=${group_by}`);
}
export async function getLlmRecentUsage(opts: { limit?: number; provider?: string; feature?: string; ticker?: string } = {}): Promise<{ count: number; rows: LlmUsageRow[] }> {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? 50));
  if (opts.provider) params.set('provider', opts.provider);
  if (opts.feature) params.set('feature', opts.feature);
  if (opts.ticker) params.set('ticker', opts.ticker);
  return apiFetch(`/admin/llm/usage/recent?${params.toString()}`);
}
export async function getLlmBudgets(): Promise<{ budgets: LlmBudget[] }> {
  return apiFetch('/admin/llm/budgets');
}
export async function setLlmBudget(payload: {
  scope_type: string;
  scope_value: string;
  daily_limit_usd?: number | null;
  monthly_limit_usd?: number | null;
  hard_cutoff?: boolean;
  alert_at_pct?: number;
  enabled?: boolean;
  notes?: string;
}): Promise<{ id: number; ok: boolean }> {
  return apiFetch('/admin/llm/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
export async function deleteLlmBudget(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/admin/llm/budgets/${id}`, { method: 'DELETE' });
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
  initial_probability?: number;
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
