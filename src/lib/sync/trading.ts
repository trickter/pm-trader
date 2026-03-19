import "server-only";

import { env } from "@/lib/env";
import { listOpenOrders, listTrades } from "@/lib/polymarket/clob-trading";
import { getPositions } from "@/lib/polymarket/data";
import { reconcileTradingState } from "@/lib/polymarket/ws";

export interface SyncResult {
  openOrders: Awaited<ReturnType<typeof listOpenOrders>>;
  trades: Awaited<ReturnType<typeof listTrades>>;
  positions: Awaited<ReturnType<typeof getPositions>>;
}

export async function syncTradingData(): Promise<SyncResult> {
  await reconcileTradingState("manual");

  const [openOrders, trades, positions] = await Promise.all([
    listOpenOrders().catch(() => []),
    listTrades().catch(() => []),
    getPositions(env.POLYMARKET_TRADER_ADDRESS || undefined).catch(() => []),
  ]);

  return {
    openOrders,
    trades,
    positions,
  };
}
