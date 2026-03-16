import type { EventCache, MarketCache } from "@prisma/client";

import type { DataPosition, GammaEvent } from "@/lib/polymarket/types";

export type PositionStatusContext = {
  position: DataPosition;
  marketCache?: MarketCache;
  eventCache?: EventCache;
  liveEvent?: GammaEvent;
};

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractBoolean(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function extractString(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "string" ? value : undefined;
}

function getEventSource(context: PositionStatusContext) {
  if (context.liveEvent) {
    return context.liveEvent as Record<string, unknown>;
  }

  if (context.eventCache?.raw && typeof context.eventCache.raw === "object") {
    return context.eventCache.raw as Record<string, unknown>;
  }

  return undefined;
}

function getMarketSource(context: PositionStatusContext) {
  if (context.marketCache?.raw && typeof context.marketCache.raw === "object") {
    return context.marketCache.raw as Record<string, unknown>;
  }

  return undefined;
}

/**
 * Main source priority:
 * 1. Local market cache when conditionId matches the position
 * 2. Live Gamma event fetched by eventId
 * 3. Local event cache
 * 4. Position endDate fallback
 *
 * Fallback rule:
 * If status cannot be confidently determined, return false so the position stays visible.
 */
export function isMarketEnded(context: PositionStatusContext, now = new Date()) {
  const marketSource = getMarketSource(context);
  const eventSource = getEventSource(context);

  const marketClosed = context.marketCache?.closed ?? extractBoolean(marketSource, "closed");
  if (marketClosed === true) {
    return true;
  }

  const marketArchived = extractBoolean(marketSource, "archived");
  if (marketArchived === true) {
    return true;
  }

  const marketResolved =
    extractBoolean(marketSource, "resolved") ??
    (extractString(marketSource, "umaResolutionStatus") === "resolved" ? true : undefined);
  if (marketResolved === true) {
    return true;
  }

  const marketActive = context.marketCache?.active ?? extractBoolean(marketSource, "active");
  if (marketActive === true) {
    return false;
  }

  const explicitMarketEndedAt =
    parseDate(extractString(marketSource, "closedTime")) ??
    parseDate(extractString(marketSource, "resolutionTime")) ??
    context.marketCache?.endDate ??
    parseDate(extractString(marketSource, "endDate"));
  if (explicitMarketEndedAt && explicitMarketEndedAt.getTime() <= now.getTime()) {
    return true;
  }

  const eventClosed = context.liveEvent?.closed ?? context.eventCache?.closed ?? extractBoolean(eventSource, "closed");
  if (eventClosed === true) {
    return true;
  }

  const eventArchived = extractBoolean(eventSource, "archived");
  if (eventArchived === true) {
    return true;
  }

  const eventResolved = extractBoolean(eventSource, "resolved");
  if (eventResolved === true) {
    return true;
  }

  const eventActive = context.liveEvent?.active ?? context.eventCache?.active ?? extractBoolean(eventSource, "active");
  if (eventActive === true) {
    return false;
  }

  const explicitEventEndedAt =
    context.liveEvent?.endDate
      ? new Date(context.liveEvent.endDate)
      : context.eventCache?.endDate ??
        parseDate(extractString(eventSource, "resolutionTime")) ??
        parseDate(extractString(eventSource, "closedTime")) ??
        parseDate(extractString(eventSource, "endDate"));
  if (explicitEventEndedAt && explicitEventEndedAt.getTime() <= now.getTime()) {
    return true;
  }

  const positionEndDate = parseDate(context.position.endDate);
  if (positionEndDate && positionEndDate.getTime() <= now.getTime()) {
    return true;
  }

  return false;
}

export function isPositionVisibleInPositionsTab(context: PositionStatusContext, now = new Date()) {
  const hasMarketOrEventLink = Boolean(
    context.position.conditionId || context.position.eventId || context.marketCache || context.eventCache || context.liveEvent,
  );

  if (!hasMarketOrEventLink) {
    // Conservative fallback: missing status context should not hide the position.
    return true;
  }

  return !isMarketEnded(context, now);
}

export function filterActivePositions(contexts: PositionStatusContext[], now = new Date()) {
  return contexts.filter((context) => isPositionVisibleInPositionsTab(context, now));
}
