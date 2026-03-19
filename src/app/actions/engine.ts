"use server";

import { revalidatePath } from "next/cache";

import { verifyAdminToken } from "@/lib/auth";
import { savePositionSnapshots } from "@/lib/polymarket/data";
import { audit } from "@/lib/risk/engine";
import { runStrategyEngineOnce } from "@/lib/strategy/engine";
import { syncTradingData } from "@/lib/sync/trading";

export async function runEngineNowAction() {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  await runStrategyEngineOnce();
  revalidatePath("/");
  revalidatePath("/strategies");
}

export async function syncTradingViewsAction() {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  const { openOrders, trades, positions } = await syncTradingData();

  await savePositionSnapshots(positions);

  await audit(
    "sync_trading_views",
    "System",
    undefined,
    {
      openOrders: openOrders.length,
      trades: trades.length,
      positions: positions.length,
    },
    "operator",
  );

  revalidatePath("/orders");
}
