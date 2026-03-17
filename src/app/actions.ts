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
import { assertManualRisk, audit } from "@/lib/risk/engine";
import { runStrategyEngineOnce } from "@/lib/strategy/engine";
import { orderbookImbalanceParamsSchema, thresholdBreakoutParamsSchema } from "@/lib/strategy/types";

const strategySchema = z.object({
  name: z.string().min(2),
  type: z.enum(["THRESHOLD_BREAKOUT", "ORDERBOOK_IMBALANCE"]),
  marketId: z.string().min(1),
  tokenId: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  maxOrderSize: z.coerce.number().positive(),
  maxDailyTradeCount: z.coerce.number().int().positive(),
  cooldownSeconds: z.coerce.number().int().nonnegative(),
  dryRun: z.coerce.boolean(),
  enabled: z.coerce.boolean(),
  threshold: z.coerce.number().optional(),
  comparator: z.enum(["gte", "lte"]).optional(),
  maxSpread: z.coerce.number().optional(),
  minTopDepth: z.coerce.number().optional(),
  imbalanceRatio: z.coerce.number().optional(),
});

export async function createStrategyAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  const values = strategySchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    marketId: formData.get("marketId"),
    tokenId: formData.get("tokenId"),
    side: formData.get("side"),
    maxOrderSize: formData.get("maxOrderSize"),
    maxDailyTradeCount: formData.get("maxDailyTradeCount"),
    cooldownSeconds: formData.get("cooldownSeconds"),
    dryRun: formData.get("dryRun") === "on",
    enabled: formData.get("enabled") === "on",
    threshold: formData.get("threshold"),
    comparator: formData.get("comparator"),
    maxSpread: formData.get("maxSpread"),
    minTopDepth: formData.get("minTopDepth"),
    imbalanceRatio: formData.get("imbalanceRatio"),
  });

  const triggerParams =
    values.type === "THRESHOLD_BREAKOUT"
      ? thresholdBreakoutParamsSchema.parse({
          threshold: values.threshold,
          comparator: values.comparator,
        })
      : orderbookImbalanceParamsSchema.parse({
          maxSpread: values.maxSpread,
          minTopDepth: values.minTopDepth,
          imbalanceRatio: values.imbalanceRatio,
        });

  await db.strategy.create({
    data: {
      name: values.name,
      type: values.type as StrategyType,
      marketId: values.marketId,
      tokenId: values.tokenId,
      side: values.side as StrategySide,
      triggerParams,
      maxOrderSize: values.maxOrderSize,
      maxDailyTradeCount: values.maxDailyTradeCount,
      cooldownSeconds: values.cooldownSeconds,
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
    walletMode: "EOA",
    defaultDryRun: formData.get("defaultDryRun") === "on",
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

  if (!runtime.defaultDryRun) {
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

export async function syncTradingViewsAction() {
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
