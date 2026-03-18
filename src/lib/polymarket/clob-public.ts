import { Chain, ClobClient, Side } from "@polymarket/clob-client";
import { z } from "zod";

import { env } from "@/lib/env";
import {
  clobOrderBookSchema,
  clobSimplePriceSchema,
  clobSpreadSchema,
} from "@/lib/polymarket/types";
import { getLiveMarketSnapshot } from "@/lib/polymarket/ws";

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

function deriveQuoteFromBook(book: Awaited<ReturnType<typeof getOrderBook>>) {
  const bestBid = book.bids[0]?.price ?? "0";
  const bestAsk = book.asks[0]?.price ?? "0";
  const spread = String(Math.max(Number(bestAsk) - Number(bestBid), 0));
  const midpoint = String((Number(bestBid) + Number(bestAsk)) / 2);

  return {
    book,
    bestBid,
    bestAsk,
    spread,
    midpoint,
    lastTradePrice: book.last_trade_price,
  };
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
  const book = await getOrderBook(tokenId);
  return deriveQuoteFromBook(book);
}

export async function getMarketQuotePreferWs(tokenId: string) {
  const snapshot = getLiveMarketSnapshot(tokenId);
  if (snapshot?.bestBid && snapshot?.bestAsk && snapshot?.book) {
    return {
      book: snapshot.book,
      spread: snapshot.spread ?? String(Number(snapshot.bestAsk) - Number(snapshot.bestBid)),
      bestBid: snapshot.bestBid,
      bestAsk: snapshot.bestAsk,
      midpoint: snapshot.midpoint ?? String((Number(snapshot.bestBid) + Number(snapshot.bestAsk)) / 2),
      lastTradePrice: snapshot.lastTradePrice ?? snapshot.bestBid,
      source: "ws" as const,
    };
  }
  const quote = await getMarketQuote(tokenId);
  return { ...quote, source: "http" as const };
}

export async function calculateExecutableMarketPrice(tokenId: string, side: "BUY" | "SELL", amount: number) {
  const result = await publicClient.calculateMarketPrice(
    tokenId,
    side === "BUY" ? Side.BUY : Side.SELL,
    amount,
  );

  return result;
}
