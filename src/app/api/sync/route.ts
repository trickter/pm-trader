import { NextResponse } from "next/server";

import { verifyBearerToken } from "@/lib/auth";
import { listOpenOrders, listTrades } from "@/lib/polymarket/clob-trading";
import { getPositions } from "@/lib/polymarket/data";
import { env } from "@/lib/env";
import { audit } from "@/lib/risk/engine";

export async function POST(request: Request) {
  if (!verifyBearerToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [openOrders, trades, positions] = await Promise.all([
    listOpenOrders().catch(() => []),
    listTrades().catch(() => []),
    getPositions(env.POLYMARKET_TRADER_ADDRESS || undefined).catch(() => []),
  ]);

  await audit("sync_trading_views", "System", undefined, {
    openOrders: openOrders.length,
    trades: trades.length,
    positions: positions.length,
  });

  return NextResponse.json({
    ok: true,
    openOrders: openOrders.length,
    trades: trades.length,
    positions: positions.length,
  });
}
