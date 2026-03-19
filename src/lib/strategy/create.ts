import "server-only";

import { StrategySide, StrategyType, type Prisma, type Strategy, type StrategyScopeType } from "@prisma/client";

import { db } from "@/lib/db";
import { parseScopeParams } from "@/lib/strategy/config";
import {
  orderbookImbalanceParamsSchema,
  thresholdBreakoutParamsSchema,
  twoSidedRangeQuotingParamsSchema,
} from "@/lib/strategy/types";

type StrategyCreateBaseInput = {
  name: string;
  scopeType?: "STATIC_MARKET" | "DISCOVERY_QUERY";
  scopeValues: {
    marketId?: string;
    tokenId?: string;
    maxMarketsTracked?: number;
    minLiquidity?: number;
    minVolume24h?: number;
    minBookDepth?: number;
    rangeMaxSpread?: number;
    minTimeToExpiryMinutes?: number;
  };
  side: StrategySide;
  maxOrderSize: number;
  maxDailyTradeCount: number;
  cooldownSeconds: number;
  pauseOnStaleData?: boolean;
  cancelOpenOrdersOnStaleData?: boolean;
  dryRun: boolean;
  enabled: boolean;
};

type ThresholdBreakoutCreateStrategyInput = StrategyCreateBaseInput & {
  type: "THRESHOLD_BREAKOUT";
  triggerValues: {
    threshold?: number;
    comparator?: "gte" | "lte";
  };
};

type OrderbookImbalanceCreateStrategyInput = StrategyCreateBaseInput & {
  type: "ORDERBOOK_IMBALANCE";
  triggerValues: {
    maxSpread?: number;
    minTopDepth?: number;
    imbalanceRatio?: number;
  };
};

type TwoSidedRangeQuotingCreateStrategyInput = StrategyCreateBaseInput & {
  type: "TWO_SIDED_RANGE_QUOTING";
  triggerValues: {
    entryLow?: number;
    entryHigh?: number;
    exitLow?: number;
    exitHigh?: number;
    orderSize?: number;
    maxInventoryPerSide?: number;
    maxInventoryPerMarket?: number;
    maxOpenOrdersPerSide?: number;
    minTopLevelSize?: number;
    maxQuoteAgeMs?: number;
    trendFilterEnabled?: boolean;
    trendFilterThreshold?: number;
    allowBothSidesInventory?: boolean;
  };
};

export type CreateStrategyInput =
  | ThresholdBreakoutCreateStrategyInput
  | OrderbookImbalanceCreateStrategyInput
  | TwoSidedRangeQuotingCreateStrategyInput;

export async function createStrategy(input: CreateStrategyInput): Promise<Strategy> {
  const scope = parseScopeParams({
    type: input.type as StrategyType,
    scopeType: input.scopeType as StrategyScopeType | undefined,
    values: input.scopeValues,
  });

  const triggerParams = buildTriggerParams(input);
  const staticTarget =
    scope.scopeType === "STATIC_MARKET"
      ? {
          marketId: String((scope.scopeParams as { marketId: string }).marketId),
          tokenId: String((scope.scopeParams as { tokenId: string }).tokenId),
        }
      : { marketId: null, tokenId: null };

  const data: Prisma.StrategyCreateInput = {
    name: input.name,
    type: input.type as StrategyType,
    scopeType: scope.scopeType,
    scopeParams: scope.scopeParams,
    marketId: staticTarget.marketId,
    tokenId: staticTarget.tokenId,
    side: input.side,
    triggerParams,
    maxOrderSize: input.maxOrderSize,
    maxDailyTradeCount: input.maxDailyTradeCount,
    cooldownSeconds: input.cooldownSeconds,
    dryRun: input.dryRun,
    enabled: input.enabled,
    ...(input.pauseOnStaleData !== undefined ? { pauseOnStaleData: input.pauseOnStaleData } : {}),
    ...(input.cancelOpenOrdersOnStaleData !== undefined
      ? { cancelOpenOrdersOnStaleData: input.cancelOpenOrdersOnStaleData }
      : {}),
  };

  return db.strategy.create({ data });
}

function buildTriggerParams(input: CreateStrategyInput): Prisma.InputJsonValue {
  if (input.type === "THRESHOLD_BREAKOUT") {
    return thresholdBreakoutParamsSchema.parse({
      threshold: input.triggerValues.threshold,
      comparator: input.triggerValues.comparator,
    });
  }

  if (input.type === "ORDERBOOK_IMBALANCE") {
    return orderbookImbalanceParamsSchema.parse({
      maxSpread: input.triggerValues.maxSpread,
      minTopDepth: input.triggerValues.minTopDepth,
      imbalanceRatio: input.triggerValues.imbalanceRatio,
    });
  }

  return twoSidedRangeQuotingParamsSchema.parse({
    entryLow: input.triggerValues.entryLow ?? 0.36,
    entryHigh: input.triggerValues.entryHigh ?? 0.42,
    exitLow: input.triggerValues.exitLow ?? 0.58,
    exitHigh: input.triggerValues.exitHigh ?? 0.64,
    orderSize: input.triggerValues.orderSize ?? 5,
    maxInventoryPerSide: input.triggerValues.maxInventoryPerSide ?? 25,
    maxInventoryPerMarket: input.triggerValues.maxInventoryPerMarket ?? 40,
    maxOpenOrdersPerSide: input.triggerValues.maxOpenOrdersPerSide ?? 2,
    maxSpread: input.scopeValues.rangeMaxSpread ?? 0.08,
    minTopLevelSize: input.triggerValues.minTopLevelSize ?? 0,
    maxQuoteAgeMs: input.triggerValues.maxQuoteAgeMs ?? 5000,
    trendFilterEnabled: input.triggerValues.trendFilterEnabled ?? true,
    trendFilterThreshold: input.triggerValues.trendFilterThreshold ?? 0.10,
    allowBothSidesInventory: input.triggerValues.allowBothSidesInventory ?? true,
  });
}
