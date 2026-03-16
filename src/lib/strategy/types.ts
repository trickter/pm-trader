import { z } from "zod";

export const thresholdBreakoutParamsSchema = z.object({
  threshold: z.coerce.number().min(0).max(1),
  comparator: z.enum(["gte", "lte"]),
});

export const orderbookImbalanceParamsSchema = z.object({
  maxSpread: z.coerce.number().min(0).max(1),
  minTopDepth: z.coerce.number().min(0),
  imbalanceRatio: z.coerce.number().min(0),
});

export type StrategySignalCandidate = {
  signalType: "PRICE_THRESHOLD" | "SPREAD_THRESHOLD" | "DEPTH_IMBALANCE";
  reason: string;
  observedPrice?: number;
  observedSpread?: number;
  bookSnapshotSummary?: {
    bestBid: string;
    bestAsk: string;
    topBidSize: string;
    topAskSize: string;
  };
};
