import { Prisma, SignalType, StrategySide, StrategyType } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getMarketById } from "@/lib/polymarket/gamma";
import { getMarketQuote } from "@/lib/polymarket/clob-public";
import { placeLimitOrder } from "@/lib/polymarket/clob-trading";
import { evaluateOrderbookImbalance } from "@/lib/strategy/rules/spread-imbalance";
import { evaluateThresholdBreakout } from "@/lib/strategy/rules/threshold-breakout";
import { hashSignal } from "@/lib/utils";
import { assertRiskBeforeOrder, audit } from "@/lib/risk/engine";

let loopStarted = false;

function jsonToInputValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function executeStrategy(strategyId: string) {
  const strategy = await db.strategy.findUnique({ where: { id: strategyId } });
  if (!strategy || !strategy.enabled) {
    return null;
  }

  const [market, quote] = await Promise.all([getMarketById(strategy.marketId), getMarketQuote(strategy.tokenId)]);
  const topBid = quote.book.bids[0];
  const topAsk = quote.book.asks[0];
  const observedPrice = Number(strategy.side === StrategySide.BUY ? quote.bestAsk : quote.bestBid);
  const observedSpread = Number(quote.spread);

  const signalCandidate =
    strategy.type === StrategyType.THRESHOLD_BREAKOUT
      ? evaluateThresholdBreakout({
          params: strategy.triggerParams,
          observedPrice,
        })
      : evaluateOrderbookImbalance({
          params: strategy.triggerParams,
          spread: observedSpread,
          bestBid: topBid?.price ?? "0",
          bestAsk: topAsk?.price ?? "0",
          topBidSize: topBid?.size ?? "0",
          topAskSize: topAsk?.size ?? "0",
        });

  await db.strategyRun.create({
    data: {
      strategyId: strategy.id,
      status: signalCandidate ? "signal" : "no_signal",
      summary: signalCandidate?.reason ?? "No trigger",
      payload: jsonToInputValue({
        quote,
        marketQuestion: market.question,
      }),
    },
  });

  if (!signalCandidate) {
    return null;
  }

  const signalHash = hashSignal([
    strategy.id,
    signalCandidate.signalType,
    signalCandidate.reason,
    signalCandidate.observedPrice,
    signalCandidate.observedSpread,
  ]);

  const signal = await db.signal.create({
    data: {
      strategyId: strategy.id,
      marketId: strategy.marketId,
      tokenId: strategy.tokenId,
      signalType: signalCandidate.signalType as SignalType,
      side: strategy.side,
      reason: signalCandidate.reason,
      observedPrice: signalCandidate.observedPrice,
      observedSpread: signalCandidate.observedSpread,
      bookSnapshotSummary: signalCandidate.bookSnapshotSummary
        ? jsonToInputValue(signalCandidate.bookSnapshotSummary)
        : undefined,
      signalHash,
    },
  });

  if (strategy.dryRun) {
    await audit("signal_generated", "Signal", signal.id, {
      strategyId: strategy.id,
      dryRun: true,
      signalType: signal.signalType,
    });
    return signal;
  }

  try {
    await assertRiskBeforeOrder({
      strategyId: strategy.id,
      marketId: strategy.marketId,
      size: Number(strategy.maxOrderSize),
      signalHash,
      traderAddress: env.POLYMARKET_TRADER_ADDRESS || undefined,
    });

    const response = await placeLimitOrder({
      tokenId: strategy.tokenId,
      side: strategy.side,
      size: Number(strategy.maxOrderSize),
      price: observedPrice,
      tickSize: String(market.orderPriceMinTickSize ?? "0.001") as "0.1" | "0.01" | "0.001" | "0.0001",
      negRisk: Boolean(market.negRisk),
    });

    await db.order.create({
      data: {
        strategyId: strategy.id,
        signalId: signal.id,
        marketId: strategy.marketId,
        tokenId: strategy.tokenId,
        polymarketOrderId: response.orderID ?? null,
        side: strategy.side,
        price: observedPrice,
        size: Number(strategy.maxOrderSize),
        status: response.success ? "SUBMITTED" : "REJECTED",
        dryRun: false,
        source: "CLOB",
        rawRequest: jsonToInputValue({
          strategyId: strategy.id,
          price: observedPrice,
        }),
        rawResponse: jsonToInputValue(response),
        errorMessage: response.success ? null : response.errorMsg ?? "Unknown order rejection",
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
    });

    return signal;
  } catch (error) {
    await db.order.create({
      data: {
        strategyId: strategy.id,
        signalId: signal.id,
        marketId: strategy.marketId,
        tokenId: strategy.tokenId,
        side: strategy.side,
        price: observedPrice,
        size: Number(strategy.maxOrderSize),
        status: "REJECTED",
        dryRun: false,
        source: "local risk",
        errorMessage: error instanceof Error ? error.message : "Unknown execution failure",
      },
    });

    await audit("order_rejected", "Signal", signal.id, {
      error: error instanceof Error ? error.message : String(error),
    });
    return signal;
  }
}

export async function runStrategyEngineOnce() {
  const strategies = await db.strategy.findMany({
    where: { enabled: true },
    orderBy: { updatedAt: "desc" },
  });

  const results = [];
  for (const strategy of strategies) {
    try {
      const result = await executeStrategy(strategy.id);
      results.push({ strategyId: strategy.id, result });
    } catch (error) {
      logger.error("engine execution failed", {
        strategyId: strategy.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await db.strategyRun.create({
        data: {
          strategyId: strategy.id,
          status: "error",
          summary: error instanceof Error ? error.message : "Unknown execution error",
        },
      });
    }
  }

  return results;
}

export function startStrategyLoop() {
  if (loopStarted || !env.ENGINE_ENABLE_BACKGROUND_LOOP) {
    return;
  }

  loopStarted = true;
  setInterval(() => {
    runStrategyEngineOnce().catch((error) => {
      logger.error("background engine loop failed", error);
    });
  }, env.ENGINE_POLL_INTERVAL_MS);
}
