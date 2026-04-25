'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calculator, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Info } from 'lucide-react';
import { InfoTooltip } from './tooltips';

interface Props {
  ticker: string;
  currentPrice: number | null;
  /** AI-estimated probability of approval/positive readout */
  probApproval: number;
  /** Expected % move on positive outcome (e.g. +35 for +35%) */
  upPct?: number | null;
  /** Expected % move on negative outcome (e.g. -25 for -25%) */
  downPct?: number | null;
  /** Optional: real options data from /strategies/{t} endpoint */
  optionsData?: OptionsData | null;
}

interface OptionContract {
  strike: number;
  bid: number;
  ask: number;
  lastPrice: number;
  impliedVolatility: number;
  openInterest?: number;
  volume?: number | null;
}

interface OptionsData {
  available?: boolean;
  expiry?: string | null;
  days_to_expiry?: number;
  calls?: OptionContract[];
  puts?: OptionContract[];
  atm_iv?: number;
}

type Mode = 'stock' | 'options';
type OptStrategy = 'long_call' | 'long_put' | 'covered_call' | 'csp' | 'iron_condor';

const fmtUsd = (v: number) => v >= 0
  ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  : `-$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtPct = (v: number, decimals = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;

export function InvestmentCalculator({ ticker, currentPrice, probApproval, upPct, downPct, optionsData }: Props) {
  const [mode, setMode] = useState<Mode>('stock');
  const [investAmount, setInvestAmount] = useState(10000);
  const [optStrategy, setOptStrategy] = useState<OptStrategy>('long_call');

  // Default expected moves if not provided  
  const upPctSafe = upPct ?? 35;
  const downPctSafe = downPct ?? -25;

  // STOCK MODE
  const stockCalc = useMemo(() => {
    if (!currentPrice || currentPrice <= 0) return null;
    const shares = Math.floor(investAmount / currentPrice);
    const actualInvest = shares * currentPrice;
    const upPriceTarget = currentPrice * (1 + upPctSafe / 100);
    const downPriceTarget = currentPrice * (1 + downPctSafe / 100);
    const upGain = (upPriceTarget - currentPrice) * shares;
    const downLoss = (downPriceTarget - currentPrice) * shares;
    const expectedReturn = (probApproval * upGain) + ((1 - probApproval) * downLoss);
    const expectedReturnPct = actualInvest > 0 ? (expectedReturn / actualInvest) * 100 : 0;

    return {
      shares,
      actualInvest,
      upPriceTarget,
      downPriceTarget,
      upGain,
      downLoss,
      expectedReturn,
      expectedReturnPct,
    };
  }, [currentPrice, investAmount, probApproval, upPctSafe, downPctSafe]);

  // OPTIONS MODE
  const optionsCalc = useMemo(() => {
    if (!currentPrice || !optionsData?.calls || !optionsData?.puts) return null;
    if (optionsData.calls.length === 0 || optionsData.puts.length === 0) return null;
    
    // Merge calls + puts by strike (mid-price = (bid+ask)/2 with fallback to lastPrice)
    const callsByStrike = new Map<number, OptionContract>();
    optionsData.calls.forEach(c => callsByStrike.set(c.strike, c));
    const putsByStrike = new Map<number, OptionContract>();
    optionsData.puts.forEach(p => putsByStrike.set(p.strike, p));
    
    const allStrikes = new Set([...callsByStrike.keys(), ...putsByStrike.keys()]);
    const mid = (c: OptionContract): number => {
      const m = (c.bid + c.ask) / 2;
      return m > 0 ? m : (c.lastPrice > 0 ? c.lastPrice : 0);
    };
    
    type S = { strike: number; call_premium: number; put_premium: number; iv?: number };
    const strikes: S[] = Array.from(allStrikes).sort((a,b) => a-b).map(strike => ({
      strike,
      call_premium: callsByStrike.has(strike) ? mid(callsByStrike.get(strike)!) : 0,
      put_premium: putsByStrike.has(strike) ? mid(putsByStrike.get(strike)!) : 0,
      iv: callsByStrike.get(strike)?.impliedVolatility ?? putsByStrike.get(strike)?.impliedVolatility,
    })).filter(s => s.call_premium > 0 || s.put_premium > 0);
    const atm = strikes.reduce((closest, s) =>
      Math.abs(s.strike - currentPrice) < Math.abs(closest.strike - currentPrice) ? s : closest
    , strikes[0]);
    
    const upPrice = currentPrice * (1 + upPctSafe / 100);
    const downPrice = currentPrice * (1 + downPctSafe / 100);

    if (optStrategy === 'long_call') {
      // Buy ATM call. Cost = premium. Max loss = premium * 100. Profit at expiry = max(0, S-K) - premium.
      const otm5 = strikes.reduce((c, s) =>
        s.strike >= currentPrice * 1.05 && (!c || s.strike < c.strike) ? s : c
      , null as typeof strikes[0] | null) || atm;
      const target = otm5;
      const premium = target.call_premium;
      const cost = premium * 100;
      const contracts = Math.floor(investAmount / cost);
      const totalCost = contracts * cost;

      const upPayoff = Math.max(0, upPrice - target.strike) * 100 * contracts;
      const downPayoff = Math.max(0, downPrice - target.strike) * 100 * contracts;
      const upGain = upPayoff - totalCost;
      const downLoss = downPayoff - totalCost;  // typically -totalCost
      const breakeven = target.strike + premium;
      const expectedReturn = probApproval * upGain + (1 - probApproval) * downLoss;

      return {
        label: 'Long Call (5% OTM)',
        legs: [{ side: 'BUY', type: 'CALL', strike: target.strike, premium, contracts }],
        expiry: optionsData.expiry,
        contracts,
        totalCost,
        maxLoss: -totalCost,
        maxGain: 'unlimited',
        upGain,
        downLoss,
        breakeven,
        expectedReturn,
        expectedReturnPct: totalCost > 0 ? (expectedReturn / totalCost) * 100 : 0,
      };
    }

    if (optStrategy === 'long_put') {
      // Buy 5% OTM put
      const otm5 = strikes.reduce((c, s) =>
        s.strike <= currentPrice * 0.95 && (!c || s.strike > c.strike) ? s : c
      , null as typeof strikes[0] | null) || atm;
      const target = otm5;
      const premium = target.put_premium;
      const cost = premium * 100;
      const contracts = Math.floor(investAmount / cost);
      const totalCost = contracts * cost;

      const upPayoff = Math.max(0, target.strike - upPrice) * 100 * contracts;
      const downPayoff = Math.max(0, target.strike - downPrice) * 100 * contracts;
      const upGain = upPayoff - totalCost; // typically -totalCost (call goes ITM is bad for long put)
      const downLoss = downPayoff - totalCost; // PROFITS here  
      const breakeven = target.strike - premium;
      const expectedReturn = probApproval * upGain + (1 - probApproval) * downLoss;

      return {
        label: 'Long Put (5% OTM)',
        legs: [{ side: 'BUY', type: 'PUT', strike: target.strike, premium, contracts }],
        expiry: optionsData.expiry,
        contracts,
        totalCost,
        maxLoss: -totalCost,
        maxGain: target.strike * 100 * contracts - totalCost,
        upGain,
        downLoss,
        breakeven,
        expectedReturn,
        expectedReturnPct: totalCost > 0 ? (expectedReturn / totalCost) * 100 : 0,
      };
    }

    if (optStrategy === 'csp') {
      // Cash-secured put: SELL ATM put, collect premium. Need cash = strike * 100 reserved per contract.
      const target = atm;
      const premium = target.put_premium;
      const reserve = target.strike * 100;  // cash reserved per contract
      const contracts = Math.floor(investAmount / reserve);
      const totalCollected = premium * 100 * contracts;
      const totalReserved = reserve * contracts;

      // Up: put expires worthless, keep premium. Win = totalCollected.
      // Down: get assigned at strike. Loss = (strike - downPrice) * 100 * contracts - totalCollected
      const upGain = totalCollected;
      const downLoss = -((target.strike - downPrice) * 100 * contracts) + totalCollected;
      const breakeven = target.strike - premium;
      const expectedReturn = probApproval * upGain + (1 - probApproval) * downLoss;

      return {
        label: 'Cash-Secured Put (ATM)',
        legs: [{ side: 'SELL', type: 'PUT', strike: target.strike, premium, contracts }],
        expiry: optionsData.expiry,
        contracts,
        totalCost: totalReserved,
        maxLoss: -((target.strike - 0) * 100 * contracts) + totalCollected,  // worst case stock → 0
        maxGain: totalCollected,
        upGain,
        downLoss,
        breakeven,
        expectedReturn,
        expectedReturnPct: totalReserved > 0 ? (expectedReturn / totalReserved) * 100 : 0,
      };
    }

    if (optStrategy === 'covered_call') {
      // Need shares + sell OTM call. Cost = stock cost (capped) - premium received.
      const otm5 = strikes.reduce((c, s) =>
        s.strike >= currentPrice * 1.05 && (!c || s.strike < c.strike) ? s : c
      , null as typeof strikes[0] | null) || atm;
      const target = otm5;
      const premium = target.call_premium;

      const sharesNeeded = 100;
      const stockCost = currentPrice * sharesNeeded;
      const netCost = stockCost - (premium * 100);
      const contracts = Math.floor(investAmount / netCost);
      if (contracts <= 0) return null;

      const totalShares = contracts * 100;
      const totalCost = contracts * netCost;
      const totalPremium = contracts * premium * 100;

      // Up: stock at upPrice but capped at strike. Profit = (strike - currentPrice) * shares + premium.
      // Or if upPrice < strike: profit = (upPrice - currentPrice) * shares + premium.
      const cappedUp = Math.min(upPrice, target.strike);
      const upGain = (cappedUp - currentPrice) * totalShares + totalPremium;
      const downLoss = (downPrice - currentPrice) * totalShares + totalPremium;
      const breakeven = currentPrice - premium;
      const expectedReturn = probApproval * upGain + (1 - probApproval) * downLoss;

      return {
        label: `Covered Call (5% OTM @ $${target.strike})`,
        legs: [
          { side: 'BUY', type: 'STOCK', strike: currentPrice, premium: 0, contracts: totalShares },
          { side: 'SELL', type: 'CALL', strike: target.strike, premium, contracts },
        ],
        expiry: optionsData.expiry,
        contracts,
        totalCost,
        maxLoss: -((currentPrice - 0) * totalShares - totalPremium),
        maxGain: (target.strike - currentPrice) * totalShares + totalPremium,
        upGain,
        downLoss,
        breakeven,
        expectedReturn,
        expectedReturnPct: totalCost > 0 ? (expectedReturn / totalCost) * 100 : 0,
      };
    }

    if (optStrategy === 'iron_condor') {
      // Sell ATM call+put, buy 10% OTM wings. Profit if stock stays in range.
      const callShort = atm;
      const callLong = strikes.reduce((c, s) =>
        s.strike >= currentPrice * 1.10 && (!c || s.strike < c.strike) ? s : c
      , null as typeof strikes[0] | null);
      const putShort = atm;
      const putLong = strikes.reduce((c, s) =>
        s.strike <= currentPrice * 0.90 && (!c || s.strike > c.strike) ? s : c
      , null as typeof strikes[0] | null);

      if (!callLong || !putLong) return null;

      const callCredit = callShort.call_premium - callLong.call_premium;
      const putCredit = putShort.put_premium - putLong.put_premium;
      const totalCredit = (callCredit + putCredit) * 100;
      const callWidth = callLong.strike - callShort.strike;
      const putWidth = putShort.strike - putLong.strike;
      const maxRiskPerContract = Math.max(callWidth, putWidth) * 100 - totalCredit;
      
      const contracts = Math.floor(investAmount / maxRiskPerContract);
      if (contracts <= 0) return null;
      const totalCost = contracts * maxRiskPerContract;
      const totalCreditCollected = contracts * totalCredit;

      // Up move: short call ITM, lose width-credit. 
      const upBlowby = upPrice > callShort.strike;
      const upGain = upBlowby
        ? -(Math.min(callWidth * 100, (upPrice - callShort.strike) * 100) * contracts) + totalCreditCollected
        : totalCreditCollected;
      const downBlowby = downPrice < putShort.strike;
      const downLoss = downBlowby
        ? -(Math.min(putWidth * 100, (putShort.strike - downPrice) * 100) * contracts) + totalCreditCollected
        : totalCreditCollected;
      const expectedReturn = probApproval * upGain + (1 - probApproval) * downLoss;

      return {
        label: 'Iron Condor (ATM ± 10%)',
        legs: [
          { side: 'SELL', type: 'CALL', strike: callShort.strike, premium: callShort.call_premium, contracts },
          { side: 'BUY', type: 'CALL', strike: callLong.strike, premium: callLong.call_premium, contracts },
          { side: 'SELL', type: 'PUT', strike: putShort.strike, premium: putShort.put_premium, contracts },
          { side: 'BUY', type: 'PUT', strike: putLong.strike, premium: putLong.put_premium, contracts },
        ],
        expiry: optionsData.expiry,
        contracts,
        totalCost,
        maxLoss: -totalCost,
        maxGain: totalCreditCollected,
        upGain,
        downLoss,
        breakeven: 0,
        expectedReturn,
        expectedReturnPct: totalCost > 0 ? (expectedReturn / totalCost) * 100 : 0,
      };
    }

    return null;
  }, [optStrategy, currentPrice, investAmount, optionsData, upPctSafe, downPctSafe, probApproval]);

  if (!currentPrice) {
    return (
      <div className="rounded-lg border border-border bg-panel p-6">
        <h3 className="mb-3 flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-cyan-400" />
          Investment Calculator
        </h3>
        <div className="text-sm text-neutral-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <h3 className="mb-4 flex items-center gap-2 text-base">
        <Calculator className="h-4 w-4 text-cyan-400" />
        Investment Calculator
        <InfoTooltip
          text={`Estimate your dollar return on this catalyst across stock and options strategies. Probabilities and expected moves are pulled from the AI analysis above. ${(!optionsData?.calls?.length) ? 'Options data not available for this ticker.' : ''}`}
          position="bottom"
        />
      </h3>

      {/* Mode toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setMode('stock')}
          className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
            mode === 'stock'
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
              : 'border-border text-neutral-400 hover:border-neutral-600'
          }`}
        >
          Stock
        </button>
        <button
          onClick={() => setMode('options')}
          disabled={!optionsData?.calls?.length || !optionsData?.puts?.length}
          className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
            mode === 'options'
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
              : 'border-border text-neutral-400 hover:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          Options {(!optionsData?.calls?.length || !optionsData?.puts?.length) && <span className="text-xs">(no chain)</span>}
        </button>
      </div>

      {/* Investment input */}
      <div className="mb-4">
        <label className="mb-1 block text-xs text-neutral-400">Investment amount</label>
        <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2">
          <DollarSign className="h-4 w-4 text-neutral-500" />
          <input
            type="number"
            value={investAmount}
            onChange={e => setInvestAmount(Math.max(0, Number(e.target.value) || 0))}
            min={0}
            step={500}
            className="flex-1 bg-transparent text-base font-mono outline-none"
          />
        </div>
      </div>

      {/* Stock mode display */}
      {mode === 'stock' && stockCalc && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Shares" value={stockCalc.shares.toLocaleString()} />
            <Stat label="Invested" value={fmtUsd(stockCalc.actualInvest)} />
            <Stat label="Cash left" value={fmtUsd(investAmount - stockCalc.actualInvest)} dim />
          </div>

          <Outcomes
            probApproval={probApproval}
            upPriceTarget={stockCalc.upPriceTarget}
            downPriceTarget={stockCalc.downPriceTarget}
            upPct={upPctSafe}
            downPct={downPctSafe}
            upDollar={stockCalc.upGain}
            downDollar={stockCalc.downLoss}
            expectedDollar={stockCalc.expectedReturn}
            expectedPct={stockCalc.expectedReturnPct}
          />
        </div>
      )}

      {/* Options mode display */}
      {mode === 'options' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['long_call','long_put','covered_call','csp','iron_condor'] as const).map(s => (
              <button
                key={s}
                onClick={() => setOptStrategy(s)}
                className={`rounded-md border px-3 py-1.5 text-xs transition ${
                  optStrategy === s
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                    : 'border-border text-neutral-400 hover:border-neutral-600'
                }`}
              >
                {s === 'long_call' ? 'Long Call' :
                 s === 'long_put' ? 'Long Put' :
                 s === 'covered_call' ? 'Covered Call' :
                 s === 'csp' ? 'Cash-Secured Put' :
                 'Iron Condor'}
              </button>
            ))}
          </div>

          {optionsCalc ? (
            <>
              <div className="rounded-md border border-border/50 bg-bg/40 p-3">
                <div className="mb-2 text-xs font-medium text-neutral-300">{optionsCalc.label}</div>
                {optionsCalc.expiry && (
                  <div className="mb-2 text-xs text-neutral-500">Expiry: {optionsCalc.expiry}</div>
                )}
                <div className="space-y-1 text-xs font-mono">
                  {optionsCalc.legs.map((leg, i) => (
                    <div key={i} className="flex justify-between">
                      <span>
                        <span className={leg.side === 'BUY' ? 'text-cyan-300' : 'text-amber-300'}>{leg.side}</span>{' '}
                        <span className="text-neutral-300">{leg.type}</span>{' '}
                        @ ${leg.strike.toFixed(2)}
                        {leg.premium > 0 && <span className="text-neutral-500"> · prem ${leg.premium.toFixed(2)}</span>}
                      </span>
                      <span className="text-neutral-500">×{leg.contracts}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Stat label="Contracts" value={optionsCalc.contracts.toString()} />
                <Stat label="Cost / margin" value={fmtUsd(optionsCalc.totalCost)} />
                <Stat label="Breakeven" value={optionsCalc.breakeven > 0 ? `$${optionsCalc.breakeven.toFixed(2)}` : 'Range'} />
              </div>

              <Outcomes
                probApproval={probApproval}
                upPriceTarget={null}
                downPriceTarget={null}
                upPct={upPctSafe}
                downPct={downPctSafe}
                upDollar={optionsCalc.upGain}
                downDollar={optionsCalc.downLoss}
                expectedDollar={optionsCalc.expectedReturn}
                expectedPct={optionsCalc.expectedReturnPct}
                maxGain={typeof optionsCalc.maxGain === 'number' ? optionsCalc.maxGain : null}
                maxLoss={optionsCalc.maxLoss}
              />
            </>
          ) : (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
              Investment too small for at least 1 contract, or no suitable strikes for this strategy.
            </div>
          )}
        </div>
      )}

      <div className="mt-3 text-[10px] leading-relaxed text-neutral-500">
        <Info className="inline h-3 w-3" /> Calculations use the AI probability ({(probApproval * 100).toFixed(0)}%)
        and expected moves from the catalyst analysis. Real options data may be delayed up to 15 minutes.
        Past performance does not predict future results.
      </div>
    </div>
  );
}

function Stat({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="rounded-md border border-border/50 bg-bg/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-sm font-mono ${dim ? 'text-neutral-500' : 'text-neutral-100'}`}>{value}</div>
    </div>
  );
}

function Outcomes({
  probApproval, upPriceTarget, downPriceTarget,
  upPct, downPct, upDollar, downDollar,
  expectedDollar, expectedPct,
  maxGain, maxLoss,
}: {
  probApproval: number;
  upPriceTarget: number | null;
  downPriceTarget: number | null;
  upPct: number;
  downPct: number;
  upDollar: number;
  downDollar: number;
  expectedDollar: number;
  expectedPct: number;
  maxGain?: number | null;
  maxLoss?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-300">
            <TrendingUp className="h-3.5 w-3.5" />
            On Approval ({(probApproval * 100).toFixed(0)}%)
          </div>
          <div className="mt-1 text-lg font-mono text-emerald-200">{fmtUsd(upDollar)}</div>
          {upPriceTarget != null && (
            <div className="mt-0.5 text-xs text-neutral-500">Stock → ${upPriceTarget.toFixed(2)} ({fmtPct(upPct)})</div>
          )}
        </div>

        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center gap-1.5 text-xs text-red-300">
            <TrendingDown className="h-3.5 w-3.5" />
            On Rejection ({((1 - probApproval) * 100).toFixed(0)}%)
          </div>
          <div className="mt-1 text-lg font-mono text-red-200">{fmtUsd(downDollar)}</div>
          {downPriceTarget != null && (
            <div className="mt-0.5 text-xs text-neutral-500">Stock → ${downPriceTarget.toFixed(2)} ({fmtPct(downPct)})</div>
          )}
        </div>
      </div>

      <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3">
        <div className="text-xs text-cyan-300">Expected return (probability-weighted)</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`text-xl font-mono ${expectedDollar >= 0 ? 'text-cyan-200' : 'text-red-200'}`}>
            {fmtUsd(expectedDollar)}
          </span>
          <span className={`text-sm font-mono ${expectedDollar >= 0 ? 'text-cyan-300' : 'text-red-300'}`}>
            ({fmtPct(expectedPct)})
          </span>
        </div>
      </div>

      {(maxGain != null || maxLoss != null) && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {maxGain != null && (
            <div className="rounded border border-border/40 px-3 py-2">
              <div className="text-neutral-500">Max gain</div>
              <div className="text-neutral-200 font-mono">{fmtUsd(maxGain)}</div>
            </div>
          )}
          {maxLoss != null && (
            <div className="rounded border border-border/40 px-3 py-2">
              <div className="text-neutral-500">Max loss</div>
              <div className="text-red-300 font-mono">{fmtUsd(maxLoss)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
