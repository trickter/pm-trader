import { Chain, ClobClient, Side } from "@polymarket/clob-client";
import { z } from "zod";

import { env } from "@/lib/env";
import {
  clobOrderBookSchema,
  clobSimplePriceSchema,
  clobSpreadSchema,
} from "@/lib/polymarket/types";

const publicClient = new ClobClient(
  env.POLYMARKET_CLOB_HOST,
  env.POLYMARKET_CHAIN_ID as Chain,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  false,
  undefined,
  undefined,
  true,
  30_000,
  true,
);

export async function getOrderBook(tokenId: string) {
  const book = await publicClient.getOrderBook(tokenId);
  return clobOrderBookSchema.parse(book);
}

export async function getBestPrice(tokenId: string, side: "buy" | "sell") {
  const price = await publicClient.getPrice(tokenId, side);
  return clobSimplePriceSchema.parse(price);
}

export async function getSpread(tokenId: string) {
  const spread = await publicClient.getSpread(tokenId);
  return clobSpreadSchema.parse(spread);
}

export async function getMidpoint(tokenId: string) {
  const midpoint = await publicClient.getMidpoint(tokenId);
  const parsed = z
    .union([
      z.object({ midpoint: z.union([z.string(), z.number()]) }),
      z.object({ mid: z.union([z.string(), z.number()]) }),
      z.union([z.string(), z.number()]).transform((value) => ({ midpoint: value })),
    ])
    .parse(midpoint);
  return { midpoint: "midpoint" in parsed ? parsed.midpoint : parsed.mid };
}

export async function getLastTradePrice(tokenId: string) {
  const price = await publicClient.getLastTradePrice(tokenId);
  return z
    .union([
      z.object({ price: z.union([z.string(), z.number()]) }),
      z.union([z.string(), z.number()]).transform((value) => ({ price: value })),
    ])
    .parse(price);
}

export async function getMarketQuote(tokenId: string) {
  const [book, spread, bestBid, bestAsk, midpoint, lastTrade] = await Promise.all([
    getOrderBook(tokenId),
    getSpread(tokenId),
    getBestPrice(tokenId, "buy"),
    getBestPrice(tokenId, "sell"),
    getMidpoint(tokenId),
    getLastTradePrice(tokenId),
  ]);

  return {
    book,
    spread: spread.spread,
    bestBid: bestBid.price,
    bestAsk: bestAsk.price,
    midpoint: midpoint.midpoint,
    lastTradePrice: lastTrade.price,
  };
}

export async function calculateExecutableMarketPrice(tokenId: string, side: "BUY" | "SELL", amount: number) {
  const result = await publicClient.calculateMarketPrice(
    tokenId,
    side === "BUY" ? Side.BUY : Side.SELL,
    amount,
  );

  return result;
}
