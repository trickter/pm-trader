import "server-only";

import { StrategySide, type Order } from "@prisma/client";

import { db } from "@/lib/db";
import { type RuntimeSettings, getRuntimeSettings } from "@/lib/db/settings";
import { env } from "@/lib/env";
import { getMarketById } from "@/lib/polymarket/gamma";
import { ensurePolymarketTargetsTracked } from "@/lib/polymarket/ws";
import type { GammaMarket } from "@/lib/polymarket/types";
import { assertManualRisk } from "@/lib/risk/engine";
import { assertTradingAllowedForExecution } from "@/lib/trading/readiness";

export interface ManualOrderInput {
  marketId: string;
  tokenId: string;
  side: StrategySide;
  size: number;
  price: number;
}

export interface ManualOrderSetupResult {
  runtime: RuntimeSettings;
  market: GammaMarket;
  localOrder: Order;
}

export async function setupManualOrder(input: ManualOrderInput): Promise<ManualOrderSetupResult> {
  const [runtime, market] = await Promise.all([getRuntimeSettings(), getMarketById(input.marketId)]);
  const target = {
    marketId: input.marketId,
    tokenId: input.tokenId,
    conditionId: market.conditionId ?? undefined,
  };

  await ensurePolymarketTargetsTracked([target]);

  if (!runtime.defaultDryRun) {
    await assertTradingAllowedForExecution(target);
    await assertManualRisk({
      conditionId: market.conditionId ?? input.marketId,
      size: input.size,
      traderAddress: env.POLYMARKET_TRADER_ADDRESS || undefined,
    });
  }

  const localOrder = await db.order.create({
    data: {
      marketId: input.marketId,
      tokenId: input.tokenId,
      side: input.side,
      price: input.price,
      size: input.size,
      status: runtime.defaultDryRun ? "PENDING" : "SUBMITTED",
      dryRun: runtime.defaultDryRun,
      source: runtime.defaultDryRun ? "local DB" : "CLOB",
      rawRequest: {
        marketId: input.marketId,
        tokenId: input.tokenId,
        side: input.side,
        price: input.price,
        size: input.size,
      },
    },
  });

  return {
    runtime,
    market,
    localOrder,
  };
}
