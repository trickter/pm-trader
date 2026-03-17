import { StrategySide } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRuntimeSettings } from "@/lib/db/settings";
import { env } from "@/lib/env";
import { getMarketById } from "@/lib/polymarket/gamma";
import { placeLimitOrder } from "@/lib/polymarket/clob-trading";
import { ensurePolymarketTargetsTracked } from "@/lib/polymarket/ws";
import { assertManualRisk, audit } from "@/lib/risk/engine";
import { assertTradingAllowedForExecution } from "@/lib/trading/readiness";

const bodySchema = z.object({
  marketId: z.string().min(1),
  tokenId: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  size: z.number().positive(),
  price: z.number().positive(),
});

export async function POST(request: Request) {
  if (!verifyBearerToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { marketId, tokenId, side, size, price } = parsed.data;

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
      rawRequest: { marketId, tokenId, side, price, size },
    },
  });

  if (!runtime.defaultDryRun) {
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
  }

  await audit("manual_order_submitted", "Order", localOrder.id, {
    dryRun: runtime.defaultDryRun,
  });

  return NextResponse.json({ ok: true, orderId: localOrder.id });
}
