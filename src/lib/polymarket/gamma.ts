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
  offset?: number;
  order?: string;
  ascending?: boolean;
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

function dedupeMarkets(markets: GammaMarket[]) {
  const seen = new Set<string>();
  return markets.filter((market) => {
    if (seen.has(market.id)) {
      return false;
    }
    seen.add(market.id);
    return true;
  });
}

export async function discoverMarkets(params: DiscoverMarketsParams = {}) {
  const markets = await fetchJson(buildUrl("/markets", params), {
    schema: gammaMarketsResponseSchema,
  });

  await Promise.all(markets.map(cacheMarket));
  return markets;
}

export async function discoverAllMarkets(
  params: Omit<DiscoverMarketsParams, 'offset'> & { maxPages?: number },
): Promise<GammaMarket[]> {
  const { maxPages = 3, ...queryParams } = params;
  const pageSize = queryParams.limit ?? 100;
  const allMarkets: GammaMarket[] = [];
  for (let page = 0; page < maxPages; page++) {
    const batch = await discoverMarkets({ ...queryParams, limit: pageSize, offset: page * pageSize });
    allMarkets.push(...batch);
    if (batch.length < pageSize) break;
  }
  return dedupeMarkets(allMarkets);
}

export async function discoverEvents(params: DiscoverMarketsParams = {}) {
  const events = await fetchJson(buildUrl("/events", params), {
    schema: gammaEventsResponseSchema,
  });

  await Promise.all(
    events.flatMap((event) => [
      cacheEvent(event),
      ...((event.markets ?? []).map((market) => cacheMarket(market))),
    ]),
  );
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

const MARKET_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getMarketById(marketId: string, options?: { skipCache?: boolean }) {
  if (!options?.skipCache) {
    const cached = await db.marketCache.findUnique({ where: { id: marketId } });
    if (cached && Date.now() - cached.lastSyncedAt.getTime() < MARKET_CACHE_TTL_MS) {
      return gammaMarketSchema.parse(cached.raw);
    }
  }
  const market = await fetchJson(buildUrl(`/markets/${marketId}`), {
    schema: gammaMarketSchema,
  });
  await cacheMarket(market);
  return market;
}

export async function getEventById(eventId: string) {
  const cached = await db.eventCache.findUnique({ where: { id: eventId } });
  if (cached) {
    return gammaEventSchema.parse(cached.raw);
  }

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
