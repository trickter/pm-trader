import { NextResponse } from "next/server";

import { verifyBearerToken } from "@/lib/auth";
import { audit } from "@/lib/risk/engine";
import { syncTradingData } from "@/lib/sync/trading";

export async function POST(request: Request) {
  if (!verifyBearerToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { openOrders, trades, positions } = await syncTradingData();

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
