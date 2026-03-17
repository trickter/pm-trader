import type { StrategySignalCandidate } from "@/lib/strategy/types";
import { twoSidedRangeQuotingParamsSchema } from "@/lib/strategy/types";

/**
 * Evaluate whether a token's current price falls within the entry band
 * for a Two-Sided Range Quoting strategy.
 *
 * Returns a RANGE_ENTRY signal when the mid price is within [entryLow, entryHigh].
 * Returns a RANGE_EXIT signal when inventory is held and mid price is within [exitLow, exitHigh].
 */
export function evaluateRangeEntry(input: {
  params: unknown;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;
  topBidSize: string;
  topAskSize: string;
  tickSize: number;
  currentInventory: number;
  maxInventoryPerSide: number;
}): StrategySignalCandidate | null {
  const params = twoSidedRangeQuotingParamsSchema.parse(input.params);

  // Cannot enter if inventory is already at max
  if (input.currentInventory >= params.maxInventoryPerSide) {
    return null;
  }

  // Spread too wide — skip
  if (input.spread > params.maxSpread) {
    return null;
  }

  // Check if mid price is within entry band
  if (input.midPrice < params.entryLow || input.midPrice > params.entryHigh) {
    return null;
  }

  // Calculate entry price: try to be best bid + 1 tick, clamped to entry band
  const rawPrice = input.bestBid + input.tickSize;
  const entryPrice = Math.min(Math.max(rawPrice, params.entryLow), params.entryHigh);

  return {
    signalType: "RANGE_ENTRY",
    reason: `Mid ${input.midPrice.toFixed(4)} in entry band [${params.entryLow}, ${params.entryHigh}], entry @ ${entryPrice.toFixed(4)}`,
    observedPrice: entryPrice,
    observedSpread: input.spread,
    side: "BUY",
    bookSnapshotSummary: {
      bestBid: String(input.bestBid),
      bestAsk: String(input.bestAsk),
      topBidSize: input.topBidSize,
      topAskSize: input.topAskSize,
    },
  };
}

export function evaluateRangeExit(input: {
  params: unknown;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;
  topBidSize: string;
  topAskSize: string;
  tickSize: number;
  currentInventory: number;
}): StrategySignalCandidate | null {
  const params = twoSidedRangeQuotingParamsSchema.parse(input.params);

  // No inventory to exit
  if (input.currentInventory <= 0) {
    return null;
  }

  // Check if mid price is within exit band
  if (input.midPrice < params.exitLow || input.midPrice > params.exitHigh) {
    return null;
  }

  // Calculate exit price: try to be best ask - 1 tick, clamped to exit band
  const rawPrice = input.bestAsk - input.tickSize;
  const exitPrice = Math.max(Math.min(rawPrice, params.exitHigh), params.exitLow);

  return {
    signalType: "RANGE_EXIT",
    reason: `Mid ${input.midPrice.toFixed(4)} in exit band [${params.exitLow}, ${params.exitHigh}], exit @ ${exitPrice.toFixed(4)}`,
    observedPrice: exitPrice,
    observedSpread: input.spread,
    side: "SELL",
    bookSnapshotSummary: {
      bestBid: String(input.bestBid),
      bestAsk: String(input.bestAsk),
      topBidSize: input.topBidSize,
      topAskSize: input.topAskSize,
    },
  };
}
