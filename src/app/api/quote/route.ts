import { NextRequest, NextResponse } from "next/server";

import { getMarketQuotePreferWs } from "@/lib/polymarket/clob-public";

export async function GET(request: NextRequest) {
  const tokenId = request.nextUrl.searchParams.get("tokenId");
  if (!tokenId) {
    return NextResponse.json({ error: "tokenId is required" }, { status: 400 });
  }

  const quote = await getMarketQuotePreferWs(tokenId);
  return NextResponse.json({
    source: quote.source === "ws" ? "CLOB market WebSocket" : "CLOB HTTP snapshot",
    quote,
  });
}
