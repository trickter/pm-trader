import { NextResponse } from "next/server";

import { runStrategyEngineOnce } from "@/lib/strategy/engine";

export async function POST() {
  const result = await runStrategyEngineOnce();
  return NextResponse.json({ ok: true, result });
}
