import type { StrategySignalCandidate } from "@/lib/strategy/types";
import { orderbookImbalanceParamsSchema } from "@/lib/strategy/types";

export function evaluateOrderbookImbalance(input: {
  params: unknown;
  spread: number;
  bestBid: string;
  bestAsk: string;
  topBidSize: string;
  topAskSize: string;
}): StrategySignalCandidate | null {
  const params = orderbookImbalanceParamsSchema.parse(input.params);
  const topBid = Number(input.topBidSize);
  const topAsk = Number(input.topAskSize);
  const totalTopDepth = topBid + topAsk;
  const imbalance = totalTopDepth > 0 ? Math.abs(topBid - topAsk) / totalTopDepth : 0;
  const matched =
    input.spread <= params.maxSpread &&
    totalTopDepth >= params.minTopDepth &&
    imbalance >= params.imbalanceRatio;

  if (!matched) {
    return null;
  }

  return {
    signalType: imbalance >= params.imbalanceRatio ? "DEPTH_IMBALANCE" : "SPREAD_THRESHOLD",
    reason: `Spread ${input.spread}, top depth ${totalTopDepth}, imbalance ${imbalance.toFixed(3)}`,
    observedSpread: input.spread,
    bookSnapshotSummary: {
      bestBid: input.bestBid,
      bestAsk: input.bestAsk,
      topBidSize: input.topBidSize,
      topAskSize: input.topAskSize,
    },
  };
}
