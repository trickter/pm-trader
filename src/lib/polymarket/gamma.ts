import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http/fetch-json";
import { toInputJson } from "@/lib/utils";
import {
  gammaEventSchema,
  gammaEventsResponseSchema,
  gammaMarketSchema,
  gammaMarketsResponseSchema,
  gammaSearchSchema,
  gammaTagsResponseSchema,
  type GammaEvent,
  type GammaMarket,
} from "@/lib/polymarket/types";

type DiscoverMarketsParams = {
  active?: boolean;
  closed?: boolean;
  limit?: number;
};

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path, env.POLYMARKET_GAMMA_HOST);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function cacheMarket(market: GammaMarket) {
  await db.marketCache.upsert({
    where: { id: market.id },
    create: {
      id: market.id,
      slug: market.slug,
      question: market.question,
      conditionId: market.conditionId ?? null,
      active: market.active ?? null,
      closed: market.closed ?? null,
      endDate: market.endDate ? new Date(market.endDate) : null,
      liquidity: market.liquidity ? String(market.liquidity) : null,
      volume: market.volume ? String(market.volume) : null,
      openInterest: market.openInterest ? String(market.openInterest) : null,
      raw: toInputJson(market),
    },
    update: {
      slug: market.slug,
      question: market.question,
      conditionId: market.conditionId ?? null,
      active: market.active ?? null,
      closed: market.closed ?? null,
      endDate: market.endDate ? new Date(market.endDate) : null,
      liquidity: market.liquidity ? String(market.liquidity) : null,
      volume: market.volume ? String(market.volume) : null,
      openInterest: market.openInterest ? String(market.openInterest) : null,
      raw: toInputJson(market),
      lastSyncedAt: new Date(),
    },
  });
}

async function cacheEvent(event: GammaEvent) {
  await db.eventCache.upsert({
    where: { id: event.id },
    create: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      active: event.active ?? null,
      closed: event.closed ?? null,
      endDate: event.endDate ? new Date(event.endDate) : null,
      liquidity: event.liquidity ? String(event.liquidity) : null,
      volume: event.volume ? String(event.volume) : null,
      openInterest: event.openInterest ? String(event.openInterest) : null,
      raw: toInputJson(event),
    },
    update: {
      slug: event.slug,
      title: event.title,
      active: event.active ?? null,
      closed: event.closed ?? null,
      endDate: event.endDate ? new Date(event.endDate) : null,
      liquidity: event.liquidity ? String(event.liquidity) : null,
      volume: event.volume ? String(event.volume) : null,
      openInterest: event.openInterest ? String(event.openInterest) : null,
      raw: toInputJson(event),
      lastSyncedAt: new Date(),
    },
  });
}

export async function discoverMarkets(params: DiscoverMarketsParams = {}) {
  const markets = await fetchJson(buildUrl("/markets", params), {
    schema: gammaMarketsResponseSchema,
  });

  await Promise.all(markets.slice(0, 10).map(cacheMarket));
  return markets;
}

export async function discoverEvents(params: DiscoverMarketsParams = {}) {
  const events = await fetchJson(buildUrl("/events", params), {
    schema: gammaEventsResponseSchema,
  });

  await Promise.all(events.slice(0, 10).map(cacheEvent));
  return events;
}

export async function searchPolymarket(query: string) {
  const result = await fetchJson(
    buildUrl("/public-search", {
      q: query,
      limit_per_type: 10,
    }),
    { schema: gammaSearchSchema },
  );

  await Promise.all(result.events.map(cacheEvent));
  await Promise.all(result.markets.map(cacheMarket));
  return result;
}

export async function getMarketById(marketId: string) {
  const market = await fetchJson(buildUrl(`/markets/${marketId}`), {
    schema: gammaMarketSchema,
  });
  await cacheMarket(market);
  return market;
}

export async function getEventById(eventId: string) {
  const event = await fetchJson(buildUrl(`/events/${eventId}`), {
    schema: gammaEventSchema,
  });
  await cacheEvent(event);
  return event;
}

export async function getTags() {
  return fetchJson(buildUrl("/tags"), {
    schema: gammaTagsResponseSchema,
  });
}
