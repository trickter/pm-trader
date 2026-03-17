import "server-only";

import { getRuntimeSettings } from "@/lib/db/settings";
import {
  ensurePolymarketTargetsTracked,
  getLiveMarketSnapshot,
  getTradingTransportHealth,
} from "@/lib/polymarket/ws";

export type TradingReadiness = {
  ready: boolean;
  marketFresh: boolean;
  userFresh: boolean;
  tradingBlocked: boolean;
  reconciling: boolean;
  blockReason: string | null;
  maxMarketDataStalenessMs: number;
  maxUserStateStalenessMs: number;
  lastMarketMessageAt: Date | null;
  lastUserMessageAt: Date | null;
  lastMarketReconciledAt: Date | null;
  lastUserReconciledAt: Date | null;
  healthDetails: Record<string, unknown>;
};

export async function getTradingReadiness() {
  const [runtime, health] = await Promise.all([
    getRuntimeSettings(),
    getTradingTransportHealth(),
  ]);

  const latestMarketActivity = Math.max(
    health.lastMarketMessageAt?.getTime() ?? 0,
    health.lastMarketReconciledAt?.getTime() ?? 0,
  );
  const latestUserActivity = Math.max(
    health.lastUserMessageAt?.getTime() ?? 0,
    health.lastUserReconciledAt?.getTime() ?? 0,
  );
  const now = Date.now();

  const marketFresh =
    !health.marketStale &&
    (latestMarketActivity === 0 || now - latestMarketActivity <= runtime.maxMarketDataStalenessMs);
  const userFresh =
    !health.userStale &&
    (latestUserActivity === 0 || now - latestUserActivity <= runtime.maxUserStateStalenessMs);

  return {
    ready: !health.tradingBlocked && !health.reconciling && marketFresh && userFresh,
    marketFresh,
    userFresh,
    tradingBlocked: health.tradingBlocked,
    reconciling: health.reconciling,
    blockReason: health.blockReason,
    maxMarketDataStalenessMs: runtime.maxMarketDataStalenessMs,
    maxUserStateStalenessMs: runtime.maxUserStateStalenessMs,
    lastMarketMessageAt: health.lastMarketMessageAt,
    lastUserMessageAt: health.lastUserMessageAt,
    lastMarketReconciledAt: health.lastMarketReconciledAt,
    lastUserReconciledAt: health.lastUserReconciledAt,
    healthDetails: health.details,
  } satisfies TradingReadiness;
}

export async function assertTradingAllowedForExecution(input?: {
  marketId?: string;
  tokenId?: string;
  conditionId?: string;
}) {
  if (input?.marketId || input?.tokenId || input?.conditionId) {
    await ensurePolymarketTargetsTracked([input]);
  }

  const readiness = await getTradingReadiness();
  if (readiness.reconciling) {
    throw new Error("RECONCILE_REQUIRED");
  }
  if (!readiness.marketFresh) {
    throw new Error("STALE_MARKET_DATA");
  }
  if (!readiness.userFresh) {
    throw new Error("STALE_USER_STATE");
  }
  if (readiness.tradingBlocked) {
    throw new Error(readiness.blockReason ?? "TRADING_BLOCKED");
  }
}

export async function assertFreshMarketData(input: { marketId?: string; tokenId: string; conditionId?: string }) {
  await ensurePolymarketTargetsTracked([input]);
  const readiness = await getTradingReadiness();
  const snapshot = getLiveMarketSnapshot(input.tokenId);

  if (!snapshot || !readiness.marketFresh) {
    throw new Error("STALE_MARKET_DATA");
  }

  return snapshot;
}
