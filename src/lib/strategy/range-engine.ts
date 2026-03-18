import { Prisma, SignalType, StrategySide, StrategyType } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getBestAskLevel, getBestBidLevel } from "@/lib/polymarket/orderbook";
import { getMarketById } from "@/lib/polymarket/gamma";
import { ensurePolymarketTargetsTracked } from "@/lib/polymarket/ws";
import { placeLimitOrder, cancelOrder } from "@/lib/polymarket/clob-trading";
import { getPositions } from "@/lib/polymarket/data";
import { assertRiskBeforeOrder, audit } from "@/lib/risk/engine";
import { getDiscoveryScope, getStaticTarget } from "@/lib/strategy/config";
import { twoSidedRangeQuotingParamsSchema, type TwoSidedRangeQuotingParams } from "@/lib/strategy/types";
import { evaluateRangeEntry, evaluateRangeExit } from "@/lib/strategy/rules/range-quoting";
import { scanMarketsForRangeQuoting, saveMarketSuitabilitySnapshots } from "@/lib/strategy/market-scanner";
import { assertFreshMarketData } from "@/lib/trading/readiness";
import { hashSignal } from "@/lib/utils";

const DEFAULT_STALE_ORDER_SECONDS = 300;

function jsonToInputValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Get current inventory for a specific token by checking positions from Data API
 * and local unfilled sell orders.
 */
async function getTokenInventory(tokenId: string, traderAddress?: string): Promise<number> {
  const positions = await getPositions(traderAddress).catch(() => []);
  const matching = positions.filter(
    (p) => String(p.asset ?? p.asset_id ?? "") === tokenId,
  );
  return matching.reduce((sum, p) => sum + Number(p.size ?? 0), 0);
}

/**
 * Count current open orders for a token and side.
 */
async function countOpenOrders(strategyId: string, tokenId: string, side: StrategySide): Promise<number> {
  return db.order.count({
    where: {
      strategyId,
      tokenId,
      side,
      status: { in: ["PENDING", "SUBMITTED"] },
    },
  });
}

/**
 * Process a single token side (YES or NO) for range quoting.
 *
 * This handles:
 * 1. Check entry conditions → place buy order
 * 2. Check exit conditions → place sell order for existing inventory
 * 3. Stale quote cancellation
 */
async function processTokenSide(
  strategy: {
    id: string;
    marketId: string;
    dryRun: boolean;
    triggerParams: unknown;
    maxOrderSize: Prisma.Decimal;
    lastSignalHash: string | null;
    lastTriggeredAt: Date | null;
    cooldownSeconds: number;
  },
  market: Awaited<ReturnType<typeof getMarketById>>,
  tokenId: string,
  tokenLabel: string,
  params: TwoSidedRangeQuotingParams,
): Promise<{ action: string; signal?: unknown } | null> {
  let quote;
  try {
    quote = await assertFreshMarketData({
      marketId: strategy.marketId,
      tokenId,
    });
  } catch (error) {
    logger.error(`range-engine: failed to get quote for ${tokenLabel}`, {
      tokenId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const bestBid = Number(quote.bestBid);
  const bestAsk = Number(quote.bestAsk);
  const midPrice = Number(quote.midpoint);
  const spread = Number(quote.spread);
  const tickSize = Number(market.orderPriceMinTickSize ?? 0.01);
  const topBid = getBestBidLevel(quote.book);
  const topAsk = getBestAskLevel(quote.book);

  if (params.maxQuoteAgeMs > 0 && Date.now() - quote.lastUpdatedAt.getTime() > params.maxQuoteAgeMs) {
    logger.info(`range-engine: skipping stale quote for ${tokenLabel}`, {
      tokenId,
      quoteAgeMs: Date.now() - quote.lastUpdatedAt.getTime(),
      maxQuoteAgeMs: params.maxQuoteAgeMs,
    });
    return null;
  }

  if (params.minTopLevelSize > 0) {
    const topBidSize = Number(topBid?.size ?? 0);
    const topAskSize = Number(topAsk?.size ?? 0);
    if (topBidSize < params.minTopLevelSize || topAskSize < params.minTopLevelSize) {
      return null;
    }
  }

  const traderAddress = env.POLYMARKET_TRADER_ADDRESS || undefined;
  const currentInventory = await getTokenInventory(tokenId, traderAddress);
  const marketDataLastUpdatedAt = quote.lastUpdatedAt;
  const marketDataSource = quote.source;

  // --- Phase 1: Check entry signal ---
  const entrySignal = evaluateRangeEntry({
    params: strategy.triggerParams,
    bestBid,
    bestAsk,
    midPrice,
    spread,
    topBidSize: topBid?.size ?? "0",
    topAskSize: topAsk?.size ?? "0",
    tickSize,
    currentInventory,
    maxInventoryPerSide: params.maxInventoryPerSide,
  });

  if (entrySignal) {
    const openBuyOrders = await countOpenOrders(strategy.id, tokenId, StrategySide.BUY);
    if (openBuyOrders < params.maxOpenOrdersPerSide) {
      return await placeRangeOrder(
        strategy,
        tokenId,
        tokenLabel,
        entrySignal,
        params,
        market,
        {
          marketDataLastUpdatedAt,
          marketDataSource,
        },
        "RANGE_ENTRY",
        StrategySide.BUY,
      );
    }
  }

  // --- Phase 2: Check exit signal (only if we have inventory) ---
  const exitSignal = evaluateRangeExit({
    params: strategy.triggerParams,
    bestBid,
    bestAsk,
    midPrice,
    spread,
    topBidSize: topBid?.size ?? "0",
    topAskSize: topAsk?.size ?? "0",
    tickSize,
    currentInventory,
  });

  if (exitSignal) {
    const openSellOrders = await countOpenOrders(strategy.id, tokenId, StrategySide.SELL);
    if (openSellOrders < params.maxOpenOrdersPerSide) {
      return await placeRangeOrder(
        strategy,
        tokenId,
        tokenLabel,
        exitSignal,
        params,
        market,
        {
          marketDataLastUpdatedAt,
          marketDataSource,
        },
        "RANGE_EXIT",
        StrategySide.SELL,
      );
    }
  }

  // --- Phase 3: Cancel stale orders ---
  await cancelStaleOrders(strategy.id, tokenId, DEFAULT_STALE_ORDER_SECONDS);

  return null;
}

/**
 * Place a range order (entry or exit) with full signal recording and risk checks.
 */
async function placeRangeOrder(
  strategy: {
    id: string;
    marketId: string;
    dryRun: boolean;
    triggerParams: unknown;
    maxOrderSize: Prisma.Decimal;
    lastSignalHash: string | null;
  },
  tokenId: string,
  tokenLabel: string,
  signalCandidate: NonNullable<ReturnType<typeof evaluateRangeEntry>>,
  params: TwoSidedRangeQuotingParams,
  market: Awaited<ReturnType<typeof getMarketById>>,
  marketDataTiming: {
    marketDataLastUpdatedAt: Date;
    marketDataSource: "ws" | "http";
  },
  signalType: "RANGE_ENTRY" | "RANGE_EXIT",
  side: StrategySide,
) {
  const price = signalCandidate.observedPrice ?? 0;
  const size = Math.min(params.orderSize, Number(strategy.maxOrderSize));

  const signalHash = hashSignal([
    strategy.id,
    signalType,
    tokenId,
    side,
    price.toFixed(4),
    signalCandidate.reason,
  ]);

  // Deduplication
  const existingSignal = await db.signal.findFirst({
    where: { strategyId: strategy.id, signalHash },
  });
  if (existingSignal) {
    logger.info(`range-engine: skipping duplicate ${signalType} signal for ${tokenLabel}`, {
      signalHash,
    });
    return null;
  }

  const signal = await db.signal.create({
    data: {
      strategyId: strategy.id,
      marketId: strategy.marketId,
      tokenId,
      signalType: signalType as SignalType,
      side,
      reason: `[${tokenLabel}] ${signalCandidate.reason}`,
      observedPrice: price,
      observedSpread: signalCandidate.observedSpread,
      bookSnapshotSummary: signalCandidate.bookSnapshotSummary
        ? jsonToInputValue(signalCandidate.bookSnapshotSummary)
        : undefined,
      signalHash,
    },
  });

  // Record the strategy run
  await db.strategyRun.create({
    data: {
      strategyId: strategy.id,
      status: "signal",
      summary: `[${tokenLabel}] ${signalType}: ${signalCandidate.reason}`,
      payload: jsonToInputValue({
        tokenId,
        tokenLabel,
        signalType,
        price,
        size,
      }),
    },
  });

  if (strategy.dryRun) {
    await audit("signal_generated", "Signal", signal.id, {
      strategyId: strategy.id,
      signalType,
      tokenLabel,
      dryRun: true,
    }, "range-engine");
    return { action: `dry-run ${signalType}`, signal };
  }

  // Live execution
  try {
    const submitStartedAtMs = Date.now();
    const marketDataLastUpdatedAtMs = marketDataTiming.marketDataLastUpdatedAt.getTime();
    const marketDataAgeMsAtSubmitStart = submitStartedAtMs - marketDataLastUpdatedAtMs;

    await assertRiskBeforeOrder({
      strategyId: strategy.id,
      conditionId: market.conditionId ?? strategy.marketId,
      size,
      signalHash,
      traderAddress: env.POLYMARKET_TRADER_ADDRESS || undefined,
    });

    const response = await placeLimitOrder({
      tokenId,
      side: side === StrategySide.BUY ? "BUY" : "SELL",
      size,
      price,
      tickSize: String(market.orderPriceMinTickSize ?? "0.01") as "0.1" | "0.01" | "0.001" | "0.0001",
      negRisk: Boolean(market.negRisk),
    });
    const submitCompletedAtMs = Date.now();
    const orderSubmissionTiming = {
      marketDataSource: marketDataTiming.marketDataSource,
      marketDataLastUpdatedAt: marketDataTiming.marketDataLastUpdatedAt.toISOString(),
      submitStartedAt: new Date(submitStartedAtMs).toISOString(),
      submitCompletedAt: new Date(submitCompletedAtMs).toISOString(),
      marketDataAgeMsAtSubmitStart,
      marketDataToSubmitCompletedMs: submitCompletedAtMs - marketDataLastUpdatedAtMs,
      submitRoundTripMs: submitCompletedAtMs - submitStartedAtMs,
    };

    await db.order.create({
      data: {
        strategyId: strategy.id,
        signalId: signal.id,
        marketId: strategy.marketId,
        tokenId,
        polymarketOrderId: response.orderID ?? null,
        side,
        price,
        size,
        status: response.success ? "SUBMITTED" : "REJECTED",
        dryRun: false,
        source: "CLOB",
        rawRequest: jsonToInputValue({
          strategyId: strategy.id,
          price,
          size,
          tokenLabel,
          orderSubmissionTiming,
        }),
        rawResponse: jsonToInputValue({
          ...response,
          orderSubmissionTiming: {
            ...orderSubmissionTiming,
            orderPersistedAt: new Date().toISOString(),
          },
        }),
        errorMessage: response.success ? null : response.errorMsg ?? "Unknown rejection",
      },
    });

    await db.signal.update({
      where: { id: signal.id },
      data: { executed: true },
    });

    await db.strategy.update({
      where: { id: strategy.id },
      data: {
        lastSignalHash: signalHash,
        lastTriggeredAt: new Date(),
      },
    });

    await audit("order_submitted", "Order", response.orderID ?? undefined, {
      strategyId: strategy.id,
      signalId: signal.id,
      signalType,
      tokenLabel,
      side,
      price,
      size,
      orderSubmissionTiming,
    }, "range-engine");

    return { action: `${signalType} order submitted`, signal };
  } catch (error) {
    const failureCapturedAtMs = Date.now();
    const orderSubmissionTiming = {
      marketDataSource: marketDataTiming.marketDataSource,
      marketDataLastUpdatedAt: marketDataTiming.marketDataLastUpdatedAt.toISOString(),
      failureCapturedAt: new Date(failureCapturedAtMs).toISOString(),
      marketDataToFailureMs: failureCapturedAtMs - marketDataTiming.marketDataLastUpdatedAt.getTime(),
    };

    await db.order.create({
      data: {
        strategyId: strategy.id,
        signalId: signal.id,
        marketId: strategy.marketId,
        tokenId,
        side,
        price,
        size,
        status: "REJECTED",
        dryRun: false,
        source: "local risk",
        rawRequest: jsonToInputValue({
          strategyId: strategy.id,
          price,
          size,
          tokenLabel,
          orderSubmissionTiming,
        }),
        errorMessage: error instanceof Error ? error.message : "Unknown execution failure",
      },
    });

    await audit("order_rejected", "Signal", signal.id, {
      error: error instanceof Error ? error.message : String(error),
      signalType,
      tokenLabel,
      orderSubmissionTiming,
    }, "range-engine");

    return { action: `${signalType} rejected: ${error instanceof Error ? error.message : "unknown"}`, signal };
  }
}

/**
 * Cancel orders that have been open longer than the stale threshold.
 */
async function cancelStaleOrders(strategyId: string, tokenId: string, staleSeconds: number) {
  const cutoff = new Date(Date.now() - staleSeconds * 1000);

  const staleOrders = await db.order.findMany({
    where: {
      strategyId,
      tokenId,
      status: { in: ["PENDING", "SUBMITTED"] },
      createdAt: { lt: cutoff },
    },
    take: 5,
  });

  for (const order of staleOrders) {
    if (order.polymarketOrderId) {
      try {
        await cancelOrder(order.polymarketOrderId);
        await db.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED" },
        });
        await audit("range_stale_quote", "Order", order.id, {
          strategyId,
          tokenId,
          ageSeconds: Math.round((Date.now() - order.createdAt.getTime()) / 1000),
        }, "range-engine");
      } catch (error) {
        logger.error("range-engine: failed to cancel stale order", {
          orderId: order.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      // Local-only order (dry-run), just mark cancelled
      await db.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
    }
  }
}

/**
 * Parse the two token IDs from a market's clobTokenIds field.
 */
function parseTokenIds(clobTokenIds: string | null | undefined): {
  yesTokenId: string | null;
  noTokenId: string | null;
} {
  if (!clobTokenIds) return { yesTokenId: null, noTokenId: null };
  try {
    const ids = JSON.parse(clobTokenIds);
    if (Array.isArray(ids) && ids.length >= 2) {
      return { yesTokenId: String(ids[0]), noTokenId: String(ids[1]) };
    }
    if (Array.isArray(ids) && ids.length === 1) {
      return { yesTokenId: String(ids[0]), noTokenId: null };
    }
  } catch { /* ignore */ }
  return { yesTokenId: null, noTokenId: null };
}

/**
 * Execute a Two-Sided Range Quoting strategy.
 *
 * This is the main entry point called by the strategy engine for strategies
 * with type = TWO_SIDED_RANGE_QUOTING.
 *
 * Execution flow:
 * 1. Parse and validate strategy parameters
 * 2. STATIC_MARKET → process the configured market directly
 * 3. DISCOVERY_QUERY → scan qualified markets, pick the best candidate, then execute
 * 3. For each token side (YES/NO), evaluate entry and exit conditions
 * 4. Place/cancel orders as needed
 * 5. Record all activity in StrategyRun, Signal, Order, and AuditLog
 */
export async function executeRangeQuotingStrategy(strategyId: string) {
  const strategy = await db.strategy.findUnique({ where: { id: strategyId } });
  if (!strategy || !strategy.enabled) {
    return null;
  }

  if (strategy.systemPausedAt) {
    await db.strategyRun.create({
      data: {
        strategyId: strategy.id,
        status: "paused",
        summary: strategy.systemPauseReason ?? "Strategy paused by stale data guard",
      },
    });
    return null;
  }

  if (strategy.type !== StrategyType.TWO_SIDED_RANGE_QUOTING) {
    logger.error("range-engine: wrong strategy type", { strategyId, type: strategy.type });
    return null;
  }

  const params = twoSidedRangeQuotingParamsSchema.parse(strategy.triggerParams);
  const staticTarget = getStaticTarget(strategy);
  const discoveryScope = getDiscoveryScope(strategy);

  // Check cooldown
  if (strategy.lastTriggeredAt) {
    const cooldownEndsAt = strategy.lastTriggeredAt.getTime() + strategy.cooldownSeconds * 1000;
    if (Date.now() < cooldownEndsAt) {
      await db.strategyRun.create({
        data: {
          strategyId: strategy.id,
          status: "cooldown",
          summary: `Cooldown active until ${new Date(cooldownEndsAt).toISOString()}`,
        },
      });
      return null;
    }
  }

  const executionMarketId =
    staticTarget?.marketId ??
    (
      await (async () => {
        if (!discoveryScope) {
          return null;
        }

        const scan = await scanMarketsForRangeQuoting(params, discoveryScope);
        await saveMarketSuitabilitySnapshots(scan.results, strategy.id);
        const candidate = scan.results.find((result) => result.qualified);

        if (!candidate) {
          await db.strategyRun.create({
            data: {
              strategyId: strategy.id,
              status: "no_signal",
              summary: "No qualified market found for discovery query scope",
              payload: jsonToInputValue({
                scanned: scan.results.length,
                diagnostics: scan.diagnostics,
              }),
            },
          });
          return null;
        }

        return candidate.marketId;
      })()
    );

  if (!executionMarketId) {
    return null;
  }

  const market = await getMarketById(executionMarketId);
  await ensurePolymarketTargetsTracked([
    {
      marketId: executionMarketId,
      conditionId: market.conditionId ?? undefined,
    },
  ]);

  // Check time to expiry
  if (market.endDate) {
    const msRemaining = new Date(market.endDate).getTime() - Date.now();
    const minutesRemaining = msRemaining / 60000;
    if (discoveryScope && minutesRemaining < discoveryScope.minTimeToExpiryMinutes) {
      await db.strategyRun.create({
        data: {
          strategyId: strategy.id,
          status: "paused",
          summary: `Market too close to expiry (${Math.round(minutesRemaining)} min remaining, minimum ${discoveryScope.minTimeToExpiryMinutes})`,
        },
      });
      await audit("range_risk_pause", "Strategy", strategyId, {
        reason: "too_close_to_expiry",
        minutesRemaining: Math.round(minutesRemaining),
      }, "range-engine");
      return null;
    }
  }

  // Determine token IDs to trade
  const { yesTokenId, noTokenId } = parseTokenIds(market.clobTokenIds);

  // If the strategy has a specific tokenId, use only that side.
  // Otherwise, try to process both sides.
  const results: Array<{ token: string; label: string; result: unknown }> = [];

  if (staticTarget?.tokenId && staticTarget.tokenId !== "auto") {
    // Single token mode: use the specified token
    const label = yesTokenId === staticTarget.tokenId ? "YES" : noTokenId === staticTarget.tokenId ? "NO" : "TOKEN";
    const result = await processTokenSide(
      {
        ...strategy,
        marketId: executionMarketId,
      },
      market,
      staticTarget.tokenId,
      label,
      params,
    );
    results.push({ token: staticTarget.tokenId, label, result });
  } else {
    // Two-sided mode: process YES and NO
    if (yesTokenId) {
      const result = await processTokenSide(
        {
          ...strategy,
          marketId: executionMarketId,
        },
        market,
        yesTokenId,
        "YES",
        params,
      );
      results.push({ token: yesTokenId, label: "YES", result });
    }
    if (noTokenId && params.allowBothSidesInventory) {
      const result = await processTokenSide(
        {
          ...strategy,
          marketId: executionMarketId,
        },
        market,
        noTokenId,
        "NO",
        params,
      );
      results.push({ token: noTokenId, label: "NO", result });
    }
  }

  // If no signals triggered, log a no_signal run
  const hasSignal = results.some((r) => r.result !== null);
  if (!hasSignal) {
    await db.strategyRun.create({
      data: {
        strategyId: strategy.id,
        status: "no_signal",
        summary: "No entry/exit conditions met for any token side",
        payload: jsonToInputValue({
          marketQuestion: market.question,
          marketId: executionMarketId,
          tokens: results.map((r) => ({ token: r.token, label: r.label })),
        }),
      },
    });
  }

  return results;
}

/**
 * Run a market scan cycle for a range quoting strategy.
 *
 * This is separate from execution — it discovers and scores candidate markets.
 * In MVP, this is called manually or on a longer interval than the execution loop.
 */
export async function runRangeQuotingMarketScan(strategyId: string) {
  const strategy = await db.strategy.findUnique({ where: { id: strategyId } });
  if (!strategy || strategy.type !== StrategyType.TWO_SIDED_RANGE_QUOTING) {
    return null;
  }

  const params = twoSidedRangeQuotingParamsSchema.parse(strategy.triggerParams);
  const scope = getDiscoveryScope(strategy);
  if (!scope) {
    await db.strategyRun.create({
      data: {
        strategyId: strategy.id,
        status: "scan",
        summary: "Strategy scope is not DISCOVERY_QUERY; skipping scan",
      },
    });
    return { total: 0, qualified: 0, results: [] };
  }

  const scan = await scanMarketsForRangeQuoting(params, scope);

  // Save suitability snapshots
  await saveMarketSuitabilitySnapshots(scan.results, strategyId);

  const qualified = scan.results.filter((r) => r.qualified);

  await db.strategyRun.create({
    data: {
      strategyId: strategy.id,
      status: "scan",
      summary: `Scanned ${scan.results.length} markets, ${qualified.length} qualified`,
      payload: jsonToInputValue({
        totalScanned: scan.results.length,
        qualified: qualified.length,
        diagnostics: scan.diagnostics,
        topMarkets: qualified.slice(0, 5).map((r) => ({
          marketId: r.marketId,
          question: r.question,
          score: r.score,
          midPrice: r.midPrice,
        })),
      }),
    },
  });

  for (const candidate of qualified.slice(0, 3)) {
    await audit("market_candidate_added", "MarketCache", candidate.marketId, {
      strategyId,
      score: candidate.score,
      question: candidate.question,
      midPrice: candidate.midPrice,
    }, "range-engine");
  }

  return { total: scan.results.length, qualified: qualified.length, results: scan.results, diagnostics: scan.diagnostics };
}
