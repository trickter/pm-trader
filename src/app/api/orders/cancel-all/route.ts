import { NextResponse } from "next/server";

import { verifyBearerToken } from "@/lib/auth";
import { cancelAllOrders } from "@/lib/polymarket/clob-trading";
import { audit } from "@/lib/risk/engine";

export async function POST(request: Request) {
  if (!verifyBearerToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await cancelAllOrders();
  await audit("cancel_all_orders", "Order");

  return NextResponse.json({ ok: true });
}
