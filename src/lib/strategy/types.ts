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

export const twoSidedRangeQuotingParamsSchema = z.object({
  // Price range parameters
  entryLow: z.coerce.number().min(0.01).max(0.99),
  entryHigh: z.coerce.number().min(0.01).max(0.99),
  exitLow: z.coerce.number().min(0.01).max(0.99),
  exitHigh: z.coerce.number().min(0.01).max(0.99),

  // Inventory control
  orderSize: z.coerce.number().positive(),
  maxInventoryPerSide: z.coerce.number().int().positive(),
  maxInventoryPerMarket: z.coerce.number().int().positive(),
  maxOpenOrdersPerSide: z.coerce.number().int().positive().default(2),
  maxSpread: z.coerce.number().min(0).max(1).default(0.08),
  minTopLevelSize: z.coerce.number().nonnegative().default(0),
  maxQuoteAgeMs: z.coerce.number().int().positive().default(5000),

  // Risk filters
  trendFilterEnabled: z.coerce.boolean().default(true),
  trendFilterThreshold: z.coerce.number().min(0).max(1).default(0.10),

  // Mode
  allowBothSidesInventory: z.coerce.boolean().default(true),
});

export type TwoSidedRangeQuotingParams = z.infer<typeof twoSidedRangeQuotingParamsSchema>;

export type StrategySignalCandidate = {
  signalType: "PRICE_THRESHOLD" | "SPREAD_THRESHOLD" | "DEPTH_IMBALANCE" | "RANGE_ENTRY" | "RANGE_EXIT";
  reason: string;
  observedPrice?: number;
  observedSpread?: number;
  side?: "BUY" | "SELL";
  tokenId?: string;
  bookSnapshotSummary?: {
    bestBid: string;
    bestAsk: string;
    topBidSize: string;
    topAskSize: string;
  };
};
