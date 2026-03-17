import "server-only";

import { db } from "@/lib/db";
import { toInputJson } from "@/lib/utils";

export const TRADING_HEALTH_KEY = "trading";

export type TradingHealthSnapshot = {
  marketWsConnected: boolean;
  userWsConnected: boolean;
  marketStale: boolean;
  userStale: boolean;
  tradingBlocked: boolean;
  reconciling: boolean;
  blockReason: string | null;
  lastMarketMessageAt: Date | null;
  lastUserMessageAt: Date | null;
  lastMarketReconciledAt: Date | null;
  lastUserReconciledAt: Date | null;
  lastHeartbeatAt: Date | null;
  details: Record<string, unknown>;
};

export const defaultTradingHealthSnapshot: TradingHealthSnapshot = {
  marketWsConnected: false,
  userWsConnected: false,
  marketStale: true,
  userStale: true,
  tradingBlocked: true,
  reconciling: false,
  blockReason: "startup",
  lastMarketMessageAt: null,
  lastUserMessageAt: null,
  lastMarketReconciledAt: null,
  lastUserReconciledAt: null,
  lastHeartbeatAt: null,
  details: {},
};

function normalizeDetails(details: unknown) {
  return typeof details === "object" && details !== null && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

export async function getStoredTradingHealth() {
  const state = await db.systemHealthState.findUnique({
    where: { key: TRADING_HEALTH_KEY },
  });

  if (!state) {
    return defaultTradingHealthSnapshot;
  }

  return {
    marketWsConnected: state.marketWsConnected,
    userWsConnected: state.userWsConnected,
    marketStale: state.marketStale,
    userStale: state.userStale,
    tradingBlocked: state.tradingBlocked,
    reconciling: state.reconciling,
    blockReason: state.blockReason,
    lastMarketMessageAt: state.lastMarketMessageAt,
    lastUserMessageAt: state.lastUserMessageAt,
    lastMarketReconciledAt: state.lastMarketReconciledAt,
    lastUserReconciledAt: state.lastUserReconciledAt,
    lastHeartbeatAt: state.lastHeartbeatAt,
    details: normalizeDetails(state.details),
  } satisfies TradingHealthSnapshot;
}

export async function persistTradingHealth(snapshot: TradingHealthSnapshot) {
  await db.systemHealthState.upsert({
    where: { key: TRADING_HEALTH_KEY },
    create: {
      key: TRADING_HEALTH_KEY,
      ...snapshot,
      details: toInputJson(snapshot.details),
    },
    update: {
      ...snapshot,
      details: toInputJson(snapshot.details),
    },
  });
}
