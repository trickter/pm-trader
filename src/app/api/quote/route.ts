import { NextRequest, NextResponse } from "next/server";

import { getMarketQuote } from "@/lib/polymarket/clob-public";
import { getLiveMarketSnapshot } from "@/lib/polymarket/ws";

export async function GET(request: NextRequest) {
  const tokenId = request.nextUrl.searchParams.get("tokenId");
  if (!tokenId) {
    return NextResponse.json({ error: "tokenId is required" }, { status: 400 });
  }

  const liveSnapshot = getLiveMarketSnapshot(tokenId);
  const quote = liveSnapshot ?? (await getMarketQuote(tokenId));
  return NextResponse.json({
    source: liveSnapshot ? "CLOB market WebSocket" : "CLOB HTTP snapshot",
    quote,
  });
}
