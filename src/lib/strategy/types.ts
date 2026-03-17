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

  // Market selection
  maxMarketsTracked: z.coerce.number().int().positive().default(10),
  minLiquidity: z.coerce.number().nonnegative().default(10000),
  minVolume24h: z.coerce.number().nonnegative().default(1000),
  minBookDepth: z.coerce.number().nonnegative().default(200),
  maxSpread: z.coerce.number().min(0).max(1).default(0.08),
  minTimeToExpiryMinutes: z.coerce.number().int().nonnegative().default(4320),

  // Execution control
  quoteRefreshSeconds: z.coerce.number().int().positive().default(60),
  staleQuoteSeconds: z.coerce.number().int().positive().default(300),
  scanIntervalSeconds: z.coerce.number().int().positive().default(300),

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
