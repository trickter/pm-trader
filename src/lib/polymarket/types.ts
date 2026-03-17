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

export const marketWsBookSchema = z.object({
  event_type: z.literal("book"),
  asset_id: z.string(),
  market: z.string(),
  bids: z.array(clobBookLevelSchema),
  asks: z.array(clobBookLevelSchema),
  hash: z.string().optional(),
  timestamp: z.string().optional(),
  min_order_size: z.string().optional(),
  tick_size: z.string().optional(),
  neg_risk: z.boolean().optional(),
  last_trade_price: z.string().optional(),
});

export const marketWsPriceChangeSchema = z.object({
  event_type: z.literal("price_change"),
  market: z.string(),
  asset_id: z.string(),
  changes: z.array(
    z.object({
      asset_id: z.string(),
      price: z.string(),
      size: z.string(),
      side: z.enum(["BUY", "SELL"]),
      hash: z.string().optional(),
      best_bid: z.string().optional(),
      best_ask: z.string().optional(),
    }),
  ),
  timestamp: z.string().optional(),
});

export const marketWsTickSizeChangeSchema = z.object({
  event_type: z.literal("tick_size_change"),
  asset_id: z.string(),
  market: z.string(),
  old_tick_size: z.string(),
  new_tick_size: z.string(),
  timestamp: z.string().optional(),
});

export const marketWsLastTradeSchema = z.object({
  event_type: z.literal("last_trade_price"),
  asset_id: z.string(),
  market: z.string(),
  price: z.string(),
  side: z.enum(["BUY", "SELL"]).optional(),
  size: z.string().optional(),
  fee_rate_bps: z.string().optional(),
  timestamp: z.string().optional(),
});

export const marketWsBestBidAskSchema = z.object({
  event_type: z.literal("best_bid_ask"),
  asset_id: z.string(),
  market: z.string(),
  best_bid: z.string(),
  best_ask: z.string(),
  spread: z.string().optional(),
  timestamp: z.string().optional(),
});

export const marketWsResolvedSchema = z.object({
  event_type: z.literal("market_resolved"),
  market: z.record(z.string(), z.unknown()),
  timestamp: z.string().optional(),
});

export const marketWsMessageSchema = z.union([
  marketWsBookSchema,
  marketWsPriceChangeSchema,
  marketWsTickSizeChangeSchema,
  marketWsLastTradeSchema,
  marketWsBestBidAskSchema,
  marketWsResolvedSchema,
]);

export const userWsOrderSchema = z.object({
  event_type: z.literal("order"),
  id: z.string(),
  market: z.string(),
  asset_id: z.string(),
  side: z.string().optional(),
  original_size: z.string().optional(),
  size_matched: z.string().optional(),
  price: z.string().optional(),
  status: z.string().optional(),
  associate_trades: z.array(z.string()).nullable().optional(),
  outcome: z.string().optional(),
  order_owner: z.string().optional(),
});

export const userWsTradeSchema = z.object({
  event_type: z.literal("trade"),
  id: z.string(),
  market: z.string(),
  asset_id: z.string(),
  side: z.string().optional(),
  size: z.string(),
  price: z.string(),
  status: z.string().optional(),
  timestamp: z.string().optional(),
  last_update: z.string().optional(),
  taker_order_id: z.string().optional(),
  trade_owner: z.string().optional(),
  maker_orders: z
    .array(
      z.object({
        order_id: z.string(),
        asset_id: z.string(),
        matched_amount: z.string().optional(),
        price: z.string().optional(),
        owner: z.string().optional(),
        maker_address: z.string().optional(),
        outcome: z.string().optional(),
        side: z.string().optional(),
      }),
    )
    .optional(),
  type: z.string().optional(),
});

export const userWsMessageSchema = z.union([userWsOrderSchema, userWsTradeSchema]);

export type GammaMarket = z.infer<typeof gammaMarketSchema>;
export type GammaEvent = z.infer<typeof gammaEventSchema>;
export type DataTrade = z.infer<typeof dataTradeSchema>;
export type DataPosition = z.infer<typeof dataPositionSchema>;
export type ClobOrderBook = z.infer<typeof clobOrderBookSchema>;
export type MarketWsMessage = z.infer<typeof marketWsMessageSchema>;
export type UserWsMessage = z.infer<typeof userWsMessageSchema>;
