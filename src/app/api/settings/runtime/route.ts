import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth";
import { setRuntimeSettings } from "@/lib/db/settings";
import { env } from "@/lib/env";
import { audit } from "@/lib/risk/engine";

const bodySchema = z.object({
  apiHost: z.string().optional(),
  chainId: z.number().optional(),
  defaultDryRun: z.boolean(),
});

export async function POST(request: Request) {
  if (!verifyBearerToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  await setRuntimeSettings({
    apiHost: parsed.data.apiHost ?? env.POLYMARKET_CLOB_HOST,
    chainId: parsed.data.chainId ?? env.POLYMARKET_CHAIN_ID,
    walletMode: "EOA",
    defaultDryRun: parsed.data.defaultDryRun,
  });

  await audit("runtime_settings_updated", "SystemSetting");

  return NextResponse.json({ ok: true });
}
