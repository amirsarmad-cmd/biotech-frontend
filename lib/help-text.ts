/**
 * Centralized help text for all info tooltips across the app.
 * 
 * Keep entries:
 * - Concise (1-3 sentences)
 * - Plain English (avoid jargon, define when used)
 * - Actionable (what does this number/section mean for me?)
 */

export const HELP = {
  // ── Screener page ──
  screener: {
    title: 'A live screener of upcoming biotech catalysts ranked by risk-adjusted opportunity. Click any row for full analysis.',
    universe: 'Total catalysts in the database. Includes upcoming FDA decisions, Phase readouts, partnerships, and more across all biotech/pharma stocks.',
    showing: 'Catalysts matching your current filters and search query.',
    high_probability: 'Catalysts with ≥70% estimated approval/positive readout probability.',
    source: 'Where the catalyst data comes from. "Live · Postgres" means current data, refreshed via daily LLM scan with Google Search grounding.',
    high_prob_filter: 'Show only catalysts where the AI confidence in approval/positive outcome is ≥70%.',
    sort: 'Reorder catalysts by overall opportunity score (default), probability, market cap, or alphabetically.',
    overall_score: 'Composite 0-1 score combining probability, news sentiment, market cap, and proximity. Higher = better risk-adjusted opportunity.',
    probability: 'AI-estimated chance of a positive outcome (FDA approval, positive Phase readout, etc).',
  },

  // ── Stock detail page ──
  stockDetail: {
    title: 'Detailed analysis of upcoming catalysts and trade strategies for this stock.',
    rating_breakdown: 'How your overall score is computed. Each factor (probability, news, market cap, days to catalyst) contributes its weighted share. Adjust weights on the /weights page.',
    catalyst_probability: 'AI-estimated likelihood of a positive outcome — drug approval, positive Phase readout, etc. Based on real-time web search of recent press releases, FDA calendars, and clinical trial data.',
    npv_analysis: 'Net Present Value — estimated value of the drug catalyst to the stock, computed as (drug peak sales × probability × time-discounted) divided by current market cap. Higher = catalyst could materially move the stock.',
    npv_drug_npv: 'Risk-adjusted Net Present Value of this drug program in $billions. Reflects the discounted cash flows expected if the drug succeeds, weighted by approval probability.',
    npv_p_approval: 'Probability of regulatory approval. Combines clinical trial success rates, indication base rates, and recent news.',
    npv_p_commercial: 'Probability of commercial success conditional on approval — accounts for competition, pricing, and market access.',
    npv_peak_sales: 'Estimated peak annual sales if drug approved (typically year 5-7 post-launch).',
    npv_multiple: 'NPV / current market cap. >0.5 means the catalyst alone could move the stock significantly.',
    npv_expected_pct: 'Expected % move on the catalyst date, weighting upside and downside by their probabilities.',
    
    all_catalysts: 'Every upcoming catalyst for this stock in the next 6 months. Earnings dates are tied separately for context but not used as primary catalysts.',
    
    section_2_stock_impact: 'Stock-level impact analysis. Shows fundamentals (cash, burn rate, runway), price history, analyst ratings, and social sentiment.',
    fundamentals_key: 'Critical numbers for evaluating financial health: cash on hand, monthly burn rate, runway months, debt, and recent capital raises.',
    fundamentals_extended: 'Additional fundamentals: operating margin, R&D spend, gross profit, employees, and other secondary metrics.',
    
    section_2b_risks: 'Adverse risk factors that could derail the catalyst. Each factor has a discount % applied to lower the probability if present (e.g. ongoing CRL = 15% discount).',
    risk_litigation: 'Active legal proceedings or settlements that could distract management or impair finances.',
    risk_fda_history: 'Past FDA Complete Response Letters (CRLs), AdComm losses, or rejected submissions for this company.',
    risk_short: 'Short interest %, days-to-cover, or rising shorts indicating bearish positioning.',
    risk_insider: 'Recent insider sales or unusual Form 4 filings that could signal disclosed-but-unannounced concerns.',
    risk_going_concern: 'Auditor going-concern opinion or warning that company may not have enough cash to continue operations.',
    risk_patent_cliff: 'Existing revenue under patent expiration threat that could shrink the upside.',
    risk_governance: 'Recent CEO/CFO/Chief Medical Officer departures or board changes that could indicate internal issues.',
    
    price_history: '1-year stock price chart. Use to spot prior catalyst-driven moves and current trend before the upcoming catalyst.',
    
    analyst: 'Wall Street analyst price targets, ratings (Buy/Hold/Sell), and consensus EPS estimates.',
    social: 'Social sentiment from StockTwits, Reddit, and Twitter/X — useful for spotting retail interest before catalysts.',
    
    trade_strategy: 'Recommended directional trade based on probability + setup. Includes timing window, target prices, and stop-loss.',
    
    ai_consensus: '3-model AI consensus analysis: Claude Opus, GPT-4o, and Gemini 2.5 each independently rate the trade. Disagreement between models is itself a signal.',
    news_x_npv: 'Recent news weighted by NPV impact — only news that could change the catalyst probability or stock value, not noise.',
    news_articles: 'Last 30 days of relevant news for this stock. Filtered to remove low-signal aggregator content.',
    
    section_3_setup: 'Technical and macro setup — chart patterns, momentum, sector flow, and macro context.',
  },

  // ── Watchlist ──
  watchlist: {
    title: 'Stocks you\'re tracking with their initial price + current catalyst data. P&L computed live.',
    initial_price: 'The price when you added this stock to your watchlist. Used as the baseline for tracking.',
    current_pl: 'Current P&L vs initial price. Doesn\'t include any actual position size — just price change.',
  },

  // ── Analytics ──
  analytics: {
    title: 'Universe-wide insights across all tracked catalysts. Use to spot themes and timing clusters.',
    total_catalysts: 'All active catalysts in the universe (excludes completed and superseded entries).',
    high_probability: 'Catalysts with ≥70% probability. These are typically the highest-conviction opportunities.',
    avg_probability: 'Mean probability across all active catalysts.',
    total_market_cap: 'Sum of market caps for all stocks with at least one active catalyst.',
    imminent: 'Catalysts within the next 14 days. These are most actionable for short-term trades.',
    top_score: 'Top 10 stocks ranked by overall opportunity score, showing only the best entry per ticker.',
    top_probability: 'Top 10 highest-probability catalysts. These are the safest plays on approval.',
    catalyst_distribution: 'Count of catalysts by type. Phase 3 Readouts and FDA Decisions are the highest-impact events.',
    industry_breakdown: 'Catalyst count by industry sector.',
  },

  // ── Weights page ──
  weights: {
    title: 'Adjust how the overall score weights each contributing factor. Saved locally in your browser.',
    catalyst_probability: 'How heavily to weight the AI-estimated probability of catalyst success. Default 35%.',
    news_sentiment: 'Polarity of recent news (positive/negative tone). Default 15%.',
    news_activity: 'Number of news articles in the last 30 days. High activity = more attention = higher weight. Default 10%.',
    market_cap: 'Larger companies have more institutional eyes on them, often providing more durable moves. Default 10%.',
    days_proximity: 'Closer catalyst dates get higher weights — imminent moves are more actionable than far-off ones. Default 30%.',
    normalize: 'Auto-scale all weights so they sum to exactly 1.00 (100%).',
    save: 'Save your custom weights to browser local storage.',
  },
};
