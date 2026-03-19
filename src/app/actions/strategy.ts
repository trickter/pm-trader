"use server";

import { z } from "zod";

import { verifyAdminToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/risk/engine";
import { createStrategy } from "@/lib/strategy/create";
import { runRangeQuotingMarketScan } from "@/lib/strategy/range-engine";
import { revalidatePath } from "next/cache";

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
  threshold: z.coerce.number().optional(),
  comparator: z.enum(["gte", "lte"]).optional(),
  maxSpread: z.coerce.number().optional(),
  minTopDepth: z.coerce.number().optional(),
  imbalanceRatio: z.coerce.number().optional(),
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

  const commonInput = {
    name: values.name,
    scopeType: values.scopeType,
    scopeValues: {
      marketId: values.marketId,
      tokenId: values.tokenId,
      maxMarketsTracked: values.maxMarketsTracked,
      minLiquidity: values.minLiquidity,
      minVolume24h: values.minVolume24h,
      minBookDepth: values.minBookDepth,
      rangeMaxSpread: values.rangeMaxSpread,
      minTimeToExpiryMinutes: values.minTimeToExpiryMinutes,
    },
    side: values.side,
    maxOrderSize: values.maxOrderSize,
    maxDailyTradeCount: values.maxDailyTradeCount,
    cooldownSeconds: values.cooldownSeconds,
    pauseOnStaleData: values.pauseOnStaleData,
    cancelOpenOrdersOnStaleData: values.cancelOpenOrdersOnStaleData,
    dryRun: values.dryRun,
    enabled: values.enabled,
  } as const;

  if (values.type === "THRESHOLD_BREAKOUT") {
    await createStrategy({
      ...commonInput,
      type: values.type,
      triggerValues: {
        threshold: values.threshold,
        comparator: values.comparator,
      },
    });
  } else if (values.type === "ORDERBOOK_IMBALANCE") {
    await createStrategy({
      ...commonInput,
      type: values.type,
      triggerValues: {
        maxSpread: values.maxSpread,
        minTopDepth: values.minTopDepth,
        imbalanceRatio: values.imbalanceRatio,
      },
    });
  } else {
    await createStrategy({
      ...commonInput,
      type: values.type,
      triggerValues: {
        entryLow: values.entryLow,
        entryHigh: values.entryHigh,
        exitLow: values.exitLow,
        exitHigh: values.exitHigh,
        orderSize: values.orderSize,
        maxInventoryPerSide: values.maxInventoryPerSide,
        maxInventoryPerMarket: values.maxInventoryPerMarket,
        maxOpenOrdersPerSide: values.maxOpenOrdersPerSide,
        minTopLevelSize: values.minTopLevelSize,
        maxQuoteAgeMs: values.maxQuoteAgeMs,
        trendFilterEnabled: values.trendFilterEnabled,
        trendFilterThreshold: values.trendFilterThreshold,
        allowBothSidesInventory: values.allowBothSidesInventory,
      },
    });
  }

  await audit(
    "strategy_created",
    "Strategy",
    undefined,
    {
      name: values.name,
      type: values.type,
    },
    "operator",
  );

  revalidatePath("/strategies");
}

export async function toggleStrategyEnabledAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  const strategyId = String(formData.get("strategyId") || "");
  const enabled = String(formData.get("enabled") || "") === "true";

  if (!strategyId) {
    throw new Error("Missing strategyId");
  }

  const strategy = await db.strategy.update({
    where: { id: strategyId },
    data: { enabled },
    select: {
      id: true,
      name: true,
      enabled: true,
    },
  });

  await audit(
    enabled ? "strategy_enabled" : "strategy_disabled",
    "Strategy",
    strategy.id,
    {
      name: strategy.name,
      enabled: strategy.enabled,
    },
    "operator",
  );

  revalidatePath("/strategies");
}

export async function deleteStrategyAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  const strategyId = String(formData.get("strategyId") || "");

  if (!strategyId) {
    throw new Error("Missing strategyId");
  }

  const strategy = await db.strategy.delete({
    where: { id: strategyId },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  await audit(
    "strategy_deleted",
    "Strategy",
    strategy.id,
    {
      name: strategy.name,
      type: strategy.type,
    },
    "operator",
  );

  revalidatePath("/strategies");
}

export async function runMarketScanAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  const strategyId = String(formData.get("strategyId"));
  const result = await runRangeQuotingMarketScan(strategyId);
  await audit(
    "market_scan_completed",
    "Strategy",
    strategyId,
    {
      totalScanned: result?.total ?? 0,
      qualified: result?.qualified ?? 0,
    },
    "operator",
  );
  revalidatePath("/strategies");
}
