import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth";
import { setRiskSettings } from "@/lib/db/settings";
import { audit } from "@/lib/risk/engine";

const bodySchema = z.object({
  globalMaxExposure: z.number(),
  perMarketMaxExposure: z.number(),
  maxOrderSize: z.number(),
  maxDailyOrders: z.number(),
  emergencyStop: z.boolean(),
});

export async function POST(request: Request) {
  if (!verifyBearerToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  await setRiskSettings(parsed.data);
  await audit("risk_settings_updated", "SystemSetting");

  return NextResponse.json({ ok: true });
}
