import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth";
import { audit } from "@/lib/risk/engine";
import { createStrategy } from "@/lib/strategy/create";

const bodySchema = z.object({
  name: z.string().min(2),
  type: z.enum(["THRESHOLD_BREAKOUT", "ORDERBOOK_IMBALANCE"]),
  marketId: z.string().min(1),
  tokenId: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  maxOrderSize: z.number().positive(),
  maxDailyTradeCount: z.number().int().positive(),
  cooldownSeconds: z.number().int().nonnegative(),
  dryRun: z.boolean(),
  enabled: z.boolean(),
  threshold: z.number().optional(),
  comparator: z.enum(["gte", "lte"]).optional(),
  maxSpread: z.number().optional(),
  minTopDepth: z.number().optional(),
  imbalanceRatio: z.number().optional(),
});

export async function POST(request: Request) {
  if (!verifyBearerToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const values = parsed.data;

  const commonInput = {
    name: values.name,
    scopeType: "STATIC_MARKET" as const,
    scopeValues: {
      marketId: values.marketId,
      tokenId: values.tokenId,
    },
    side: values.side,
    maxOrderSize: values.maxOrderSize,
    maxDailyTradeCount: values.maxDailyTradeCount,
    cooldownSeconds: values.cooldownSeconds,
    dryRun: values.dryRun,
    enabled: values.enabled,
  };

  const strategy =
    values.type === "THRESHOLD_BREAKOUT"
      ? await createStrategy({
          ...commonInput,
          type: values.type,
          triggerValues: {
            threshold: values.threshold,
            comparator: values.comparator,
          },
        })
      : await createStrategy({
          ...commonInput,
          type: values.type,
          triggerValues: {
            maxSpread: values.maxSpread,
            minTopDepth: values.minTopDepth,
            imbalanceRatio: values.imbalanceRatio,
          },
        });

  await audit("strategy_created", "Strategy", undefined, {
    name: values.name,
    type: values.type,
  });

  return NextResponse.json({ ok: true, strategy });
}
