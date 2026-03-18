"use server";

import { StrategySide, StrategyType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyAdminToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRuntimeSettings, setRiskSettings, setRuntimeSettings } from "@/lib/db/settings";
import { env } from "@/lib/env";
import { getMarketById } from "@/lib/polymarket/gamma";
import { listOpenOrders, listTrades, placeLimitOrder, cancelAllOrders } from "@/lib/polymarket/clob-trading";
import { getPositions, savePositionSnapshots } from "@/lib/polymarket/data";
import { ensurePolymarketTargetsTracked, reconcileTradingState } from "@/lib/polymarket/ws";
import { getTradingScope } from "@/lib/polymarket/server-config";
import { assertManualRisk, audit } from "@/lib/risk/engine";
import { runStrategyEngineOnce } from "@/lib/strategy/engine";
import { parseScopeParams } from "@/lib/strategy/config";
import {
  orderbookImbalanceParamsSchema,
  thresholdBreakoutParamsSchema,
  twoSidedRangeQuotingParamsSchema,
} from "@/lib/strategy/types";
import { runRangeQuotingMarketScan } from "@/lib/strategy/range-engine";
import { assertTradingAllowedForExecution } from "@/lib/trading/readiness";

const strategySchema = z.object({
  name: z.string().min(2),
  type: z.enum(["THRESHOLD_BREAKOUT", "ORDERBOOK_IMBALANCE", "TWO_SIDED_RANGE_QUOTING"]),
  scopeType: z.enum(["STATIC_MARKET", "DISCOVERY_QUERY"]).optional(),
  marketId: z.string().optional(),
  tokenId: z.string().optional(),
  side: z.enum(["BUY", "SELL"]),
  maxOrderSize: z.coerce.number().positive(),
  maxDailyTradeCount: z.coerce.number().int().positive(),
  cooldownSeconds: z.coerce.number().int().nonnegative(),
  pauseOnStaleData: z.coerce.boolean(),
  cancelOpenOrdersOnStaleData: z.coerce.boolean(),
  dryRun: z.coerce.boolean(),
  enabled: z.coerce.boolean(),
  // THRESHOLD_BREAKOUT params
  threshold: z.coerce.number().optional(),
  comparator: z.enum(["gte", "lte"]).optional(),
  // ORDERBOOK_IMBALANCE params
  maxSpread: z.coerce.number().optional(),
  minTopDepth: z.coerce.number().optional(),
  imbalanceRatio: z.coerce.number().optional(),
  // TWO_SIDED_RANGE_QUOTING params
  entryLow: z.coerce.number().optional(),
  entryHigh: z.coerce.number().optional(),
  exitLow: z.coerce.number().optional(),
  exitHigh: z.coerce.number().optional(),
  orderSize: z.coerce.number().optional(),
  maxInventoryPerSide: z.coerce.number().optional(),
  maxInventoryPerMarket: z.coerce.number().optional(),
  maxOpenOrdersPerSide: z.coerce.number().optional(),
  maxMarketsTracked: z.coerce.number().optional(),
  minLiquidity: z.coerce.number().optional(),
  minVolume24h: z.coerce.number().optional(),
  minBookDepth: z.coerce.number().optional(),
  rangeMaxSpread: z.coerce.number().optional(),
  minTimeToExpiryMinutes: z.coerce.number().optional(),
  minTopLevelSize: z.coerce.number().optional(),
  maxQuoteAgeMs: z.coerce.number().optional(),
  trendFilterEnabled: z.coerce.boolean().optional(),
  trendFilterThreshold: z.coerce.number().optional(),
  allowBothSidesInventory: z.coerce.boolean().optional(),
});

function getOptionalFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value == null) {
    return undefined;
  }

  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export async function createStrategyAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  const values = strategySchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    scopeType: getOptionalFormValue(formData, "scopeType"),
    marketId: getOptionalFormValue(formData, "marketId"),
    tokenId: getOptionalFormValue(formData, "tokenId"),
    side: formData.get("side"),
    maxOrderSize: formData.get("maxOrderSize"),
    maxDailyTradeCount: formData.get("maxDailyTradeCount"),
    cooldownSeconds: formData.get("cooldownSeconds"),
    pauseOnStaleData: formData.get("pauseOnStaleData") === "on",
    cancelOpenOrdersOnStaleData: formData.get("cancelOpenOrdersOnStaleData") === "on",
    dryRun: formData.get("dryRun") === "on",
    enabled: formData.get("enabled") === "on",
    threshold: getOptionalFormValue(formData, "threshold"),
    comparator: getOptionalFormValue(formData, "comparator"),
    maxSpread: getOptionalFormValue(formData, "maxSpread"),
    minTopDepth: getOptionalFormValue(formData, "minTopDepth"),
    imbalanceRatio: getOptionalFormValue(formData, "imbalanceRatio"),
    entryLow: getOptionalFormValue(formData, "entryLow"),
    entryHigh: getOptionalFormValue(formData, "entryHigh"),
    exitLow: getOptionalFormValue(formData, "exitLow"),
    exitHigh: getOptionalFormValue(formData, "exitHigh"),
    orderSize: getOptionalFormValue(formData, "orderSize"),
    maxInventoryPerSide: getOptionalFormValue(formData, "maxInventoryPerSide"),
    maxInventoryPerMarket: getOptionalFormValue(formData, "maxInventoryPerMarket"),
    maxOpenOrdersPerSide: getOptionalFormValue(formData, "maxOpenOrdersPerSide"),
    maxMarketsTracked: getOptionalFormValue(formData, "maxMarketsTracked"),
    minLiquidity: getOptionalFormValue(formData, "minLiquidity"),
    minVolume24h: getOptionalFormValue(formData, "minVolume24h"),
    minBookDepth: getOptionalFormValue(formData, "minBookDepth"),
    rangeMaxSpread: getOptionalFormValue(formData, "rangeMaxSpread"),
    minTimeToExpiryMinutes: getOptionalFormValue(formData, "minTimeToExpiryMinutes"),
    minTopLevelSize: getOptionalFormValue(formData, "minTopLevelSize"),
    maxQuoteAgeMs: getOptionalFormValue(formData, "maxQuoteAgeMs"),
    trendFilterEnabled: formData.get("trendFilterEnabled") === "on",
    trendFilterThreshold: getOptionalFormValue(formData, "trendFilterThreshold"),
    allowBothSidesInventory: formData.get("allowBothSidesInventory") === "on",
  });

  const scope = parseScopeParams({
    type: values.type as StrategyType,
    scopeType: values.scopeType as "STATIC_MARKET" | "DISCOVERY_QUERY" | undefined,
    values: {
      marketId: values.marketId,
      tokenId: values.tokenId,
      maxMarketsTracked: values.maxMarketsTracked,
      minLiquidity: values.minLiquidity,
      minVolume24h: values.minVolume24h,
      minBookDepth: values.minBookDepth,
      rangeMaxSpread: values.rangeMaxSpread,
      minTimeToExpiryMinutes: values.minTimeToExpiryMinutes,
    },
  });

  let triggerParams;
  if (values.type === "THRESHOLD_BREAKOUT") {
    triggerParams = thresholdBreakoutParamsSchema.parse({
      threshold: values.threshold,
      comparator: values.comparator,
    });
  } else if (values.type === "ORDERBOOK_IMBALANCE") {
    triggerParams = orderbookImbalanceParamsSchema.parse({
      maxSpread: values.maxSpread,
      minTopDepth: values.minTopDepth,
      imbalanceRatio: values.imbalanceRatio,
    });
  } else {
    triggerParams = twoSidedRangeQuotingParamsSchema.parse({
      entryLow: values.entryLow ?? 0.36,
      entryHigh: values.entryHigh ?? 0.42,
      exitLow: values.exitLow ?? 0.58,
      exitHigh: values.exitHigh ?? 0.64,
      orderSize: values.orderSize ?? 5,
      maxInventoryPerSide: values.maxInventoryPerSide ?? 25,
      maxInventoryPerMarket: values.maxInventoryPerMarket ?? 40,
      maxOpenOrdersPerSide: values.maxOpenOrdersPerSide ?? 2,
      maxSpread: values.rangeMaxSpread ?? 0.08,
      minTopLevelSize: values.minTopLevelSize ?? 0,
      maxQuoteAgeMs: values.maxQuoteAgeMs ?? 5000,
      trendFilterEnabled: values.trendFilterEnabled ?? true,
      trendFilterThreshold: values.trendFilterThreshold ?? 0.10,
      allowBothSidesInventory: values.allowBothSidesInventory ?? true,
    });
  }

  const staticTarget =
    scope.scopeType === "STATIC_MARKET"
      ? {
          marketId: String((scope.scopeParams as { marketId: string }).marketId),
          tokenId: String((scope.scopeParams as { tokenId: string }).tokenId),
        }
      : { marketId: null, tokenId: null };

  await db.strategy.create({
    data: {
      name: values.name,
      type: values.type as StrategyType,
      scopeType: scope.scopeType,
      scopeParams: scope.scopeParams,
      marketId: staticTarget.marketId,
      tokenId: staticTarget.tokenId,
      side: values.side as StrategySide,
      triggerParams,
      maxOrderSize: values.maxOrderSize,
      maxDailyTradeCount: values.maxDailyTradeCount,
      cooldownSeconds: values.cooldownSeconds,
      pauseOnStaleData: values.pauseOnStaleData,
      cancelOpenOrdersOnStaleData: values.cancelOpenOrdersOnStaleData,
      dryRun: values.dryRun,
      enabled: values.enabled,
    },
  });

  await audit("strategy_created", "Strategy", undefined, {
    name: values.name,
    type: values.type,
  }, "operator");

  revalidatePath("/strategies");
}

export async function updateRiskSettingsAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  await setRiskSettings({
    globalMaxExposure: Number(formData.get("globalMaxExposure")),
    perMarketMaxExposure: Number(formData.get("perMarketMaxExposure")),
    maxOrderSize: Number(formData.get("maxOrderSize")),
    maxDailyOrders: Number(formData.get("maxDailyOrders")),
    emergencyStop: formData.get("emergencyStop") === "on",
  });

  await audit("risk_settings_updated", "SystemSetting", undefined, undefined, "operator");
  revalidatePath("/risk");
}

export async function updateRuntimeSettingsAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  await setRuntimeSettings({
    apiHost: String(formData.get("apiHost") || env.POLYMARKET_CLOB_HOST),
    chainId: Number(formData.get("chainId") || env.POLYMARKET_CHAIN_ID),
    walletMode: getTradingScope().walletMode,
    signatureType: getTradingScope().signatureType,
    defaultDryRun: formData.get("defaultDryRun") === "on",
    maxMarketDataStalenessMs: Number(formData.get("maxMarketDataStalenessMs") || 5000),
    maxUserStateStalenessMs: Number(formData.get("maxUserStateStalenessMs") || 5000),
  });

  await audit("runtime_settings_updated", "SystemSetting", undefined, undefined, "operator");
  revalidatePath("/settings");
}

export async function runEngineNowAction() {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  await runStrategyEngineOnce();
  revalidatePath("/");
  revalidatePath("/strategies");
}

export async function placeManualOrderAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  const marketId = String(formData.get("marketId"));
  const tokenId = String(formData.get("tokenId"));
  const side = String(formData.get("side")) as "BUY" | "SELL";
  const size = Number(formData.get("size"));
  const price = Number(formData.get("price"));

  const runtime = await getRuntimeSettings();
  const market = await getMarketById(marketId);

  await ensurePolymarketTargetsTracked([
    {
      marketId,
      tokenId,
      conditionId: market.conditionId ?? undefined,
    },
  ]);

  if (!runtime.defaultDryRun) {
    await assertTradingAllowedForExecution({
      marketId,
      tokenId,
      conditionId: market.conditionId ?? undefined,
    });
    await assertManualRisk({
      conditionId: market.conditionId ?? marketId,
      size,
      traderAddress: env.POLYMARKET_TRADER_ADDRESS || undefined,
    });
  }

  const localOrder = await db.order.create({
    data: {
      marketId,
      tokenId,
      side: side as StrategySide,
      price,
      size,
      status: runtime.defaultDryRun ? "PENDING" : "SUBMITTED",
      dryRun: runtime.defaultDryRun,
      source: runtime.defaultDryRun ? "local DB" : "CLOB",
      rawRequest: {
        marketId,
        tokenId,
        side,
        price,
        size,
      },
    },
  });

  if (!runtime.defaultDryRun) {
    try {
      const response = await placeLimitOrder({
        tokenId,
        side,
        size,
        price,
        tickSize: String(market.orderPriceMinTickSize ?? "0.001") as "0.1" | "0.01" | "0.001" | "0.0001",
        negRisk: Boolean(market.negRisk),
      });

      await db.order.update({
        where: { id: localOrder.id },
        data: {
          polymarketOrderId: response.orderID ?? null,
          rawResponse: response,
          status: response.success ? "SUBMITTED" : "REJECTED",
          errorMessage: response.success ? null : response.errorMsg ?? null,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await db.order.update({
        where: { id: localOrder.id },
        data: {
          status: "REJECTED",
          errorMessage,
          rawResponse: { error: errorMessage },
        },
      });
    }
  }

  await audit("manual_order_submitted", "Order", localOrder.id, {
    dryRun: runtime.defaultDryRun,
  }, "operator");
  revalidatePath("/orders");
}

export async function cancelAllOrdersAction() {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  await cancelAllOrders();
  await audit("cancel_all_orders", "Order", undefined, undefined, "operator");
  revalidatePath("/orders");
  revalidatePath("/risk");
}

export async function runMarketScanAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  const strategyId = String(formData.get("strategyId"));
  const result = await runRangeQuotingMarketScan(strategyId);
  await audit("market_scan_completed", "Strategy", strategyId, {
    totalScanned: result?.total ?? 0,
    qualified: result?.qualified ?? 0,
  }, "operator");
  revalidatePath("/strategies");
}

export async function syncTradingViewsAction() {
  await reconcileTradingState("manual");

  const [openOrders, trades, positions] = await Promise.all([
    listOpenOrders().catch(() => []),
    listTrades().catch(() => []),
    getPositions(env.POLYMARKET_TRADER_ADDRESS || undefined).catch(() => []),
  ]);

  await savePositionSnapshots(positions);

  await audit("sync_trading_views", "System", undefined, {
    openOrders: openOrders.length,
    trades: trades.length,
    positions: positions.length,
  }, "operator");

  revalidatePath("/orders");
}
