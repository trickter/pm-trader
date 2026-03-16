import { z } from "zod";

export const gammaTagSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    label: z.string().optional(),
    slug: z.string().optional(),
  })
  .passthrough();

export const gammaMarketSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    question: z.string(),
    conditionId: z.string().optional().nullable(),
    slug: z.string(),
    endDate: z.string().optional().nullable(),
    startDate: z.string().optional().nullable(),
    liquidity: z.union([z.string(), z.number()]).optional().nullable(),
    volume: z.union([z.string(), z.number()]).optional().nullable(),
    volume24hr: z.number().optional().nullable(),
    openInterest: z.union([z.string(), z.number()]).optional().nullable(),
    active: z.boolean().optional(),
    closed: z.boolean().optional(),
    spread: z.number().optional().nullable(),
    bestBid: z.number().optional().nullable(),
    bestAsk: z.number().optional().nullable(),
    lastTradePrice: z.number().optional().nullable(),
    outcomes: z.string().optional().nullable(),
    outcomePrices: z.string().optional().nullable(),
    clobTokenIds: z.string().optional().nullable(),
    orderPriceMinTickSize: z.number().optional().nullable(),
    orderMinSize: z.union([z.number(), z.string()]).optional().nullable(),
    acceptingOrders: z.boolean().optional().nullable(),
    negRisk: z.boolean().optional().nullable(),
  })
  .passthrough();

export const gammaEventSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    slug: z.string(),
    title: z.string(),
    description: z.string().optional(),
    active: z.boolean().optional(),
    closed: z.boolean().optional(),
    endDate: z.string().optional().nullable(),
    liquidity: z.union([z.string(), z.number()]).optional().nullable(),
    volume: z.union([z.string(), z.number()]).optional().nullable(),
    openInterest: z.union([z.string(), z.number()]).optional().nullable(),
    tags: z.array(gammaTagSchema).optional(),
    markets: z.array(gammaMarketSchema).optional(),
  })
  .passthrough();

export const gammaSearchSchema = z.object({
  events: z.array(gammaEventSchema).optional().default([]),
  markets: z.array(gammaMarketSchema).optional().default([]),
  profiles: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  pagination: z
    .object({
      hasMore: z.boolean().optional(),
      totalResults: z.number().optional(),
    })
    .optional(),
});

export const gammaMarketsResponseSchema = z.array(gammaMarketSchema);
export const gammaEventsResponseSchema = z.array(gammaEventSchema);
export const gammaTagsResponseSchema = z.array(gammaTagSchema);

export const dataTradeSchema = z
  .object({
    proxyWallet: z.string().optional(),
    side: z.enum(["BUY", "SELL"]),
    asset: z.string(),
    conditionId: z.string(),
    size: z.number(),
    price: z.number(),
    timestamp: z.number(),
    title: z.string().optional(),
    slug: z.string().optional(),
    eventSlug: z.string().optional(),
    outcome: z.string().optional(),
    transactionHash: z.string().optional(),
  })
  .passthrough();

export const dataTradeResponseSchema = z.array(dataTradeSchema);

export const dataPositionSchema = z
  .object({
    proxyWallet: z.string().optional(),
    asset: z.string().optional(),
    asset_id: z.string().optional(),
    conditionId: z.string().optional(),
    size: z.union([z.number(), z.string()]).optional(),
    avgPrice: z.union([z.number(), z.string()]).optional(),
    currentValue: z.union([z.number(), z.string()]).optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    icon: z.string().optional(),
    eventId: z.union([z.string(), z.number()]).transform(String).optional(),
    eventSlug: z.string().optional(),
    outcome: z.string().optional(),
    outcomeIndex: z.union([z.string(), z.number()]).optional(),
    oppositeOutcome: z.string().optional(),
    oppositeAsset: z.string().optional(),
    endDate: z.string().optional(),
    redeemable: z.boolean().optional(),
    mergeable: z.boolean().optional(),
    negativeRisk: z.boolean().optional(),
  })
  .passthrough();
export const dataPositionResponseSchema = z.array(dataPositionSchema);

export const clobBookLevelSchema = z.object({
  price: z.string(),
  size: z.string(),
});

export const clobOrderBookSchema = z.object({
  market: z.string(),
  asset_id: z.string(),
  timestamp: z.string(),
  hash: z.string(),
  bids: z.array(clobBookLevelSchema),
  asks: z.array(clobBookLevelSchema),
  min_order_size: z.string(),
  tick_size: z.string(),
  neg_risk: z.boolean(),
  last_trade_price: z.string(),
});

export const clobSimplePriceSchema = z.object({
  price: z.string(),
});

export const clobSpreadSchema = z.object({
  spread: z.string(),
});

export type GammaMarket = z.infer<typeof gammaMarketSchema>;
export type GammaEvent = z.infer<typeof gammaEventSchema>;
export type DataTrade = z.infer<typeof dataTradeSchema>;
export type DataPosition = z.infer<typeof dataPositionSchema>;
export type ClobOrderBook = z.infer<typeof clobOrderBookSchema>;
