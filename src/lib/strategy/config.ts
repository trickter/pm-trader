import { StrategyScopeType, StrategyType } from "@prisma/client";
import { z } from "zod";

export const strategyTypeSchema = z.nativeEnum(StrategyType);
export const strategyScopeTypeSchema = z.nativeEnum(StrategyScopeType);

export const staticMarketScopeParamsSchema = z.object({
  marketId: z.string().min(1),
  tokenId: z.string().min(1),
});

export const discoveryQueryScopeParamsSchema = z.object({
  maxMarketsTracked: z.coerce.number().int().positive().default(10),
  minLiquidity: z.coerce.number().nonnegative().default(10000),
  minVolume24h: z.coerce.number().nonnegative().default(1000),
  minBookDepth: z.coerce.number().nonnegative().default(200),
  maxSpread: z.coerce.number().min(0).max(1).default(0.08),
  minTimeToExpiryMinutes: z.coerce.number().int().nonnegative().default(4320),
});

export type StaticMarketScopeParams = z.infer<typeof staticMarketScopeParamsSchema>;
export type DiscoveryQueryScopeParams = z.infer<typeof discoveryQueryScopeParamsSchema>;

export function defaultScopeTypeForStrategy(type: StrategyType) {
  return type === StrategyType.TWO_SIDED_RANGE_QUOTING
    ? StrategyScopeType.DISCOVERY_QUERY
    : StrategyScopeType.STATIC_MARKET;
}

export function supportedScopeTypesForStrategy(type: StrategyType) {
  return type === StrategyType.TWO_SIDED_RANGE_QUOTING
    ? [StrategyScopeType.DISCOVERY_QUERY] as const
    : [StrategyScopeType.STATIC_MARKET] as const;
}

export function parseScopeParams(input: {
  type: StrategyType;
  scopeType?: StrategyScopeType | null;
  scopeParams?: unknown;
  marketId?: string | null;
  tokenId?: string | null;
  values?: Record<string, FormDataEntryValue | boolean | number | string | null | undefined>;
}) {
  const scopeType = input.scopeType ?? defaultScopeTypeForStrategy(input.type);

  if (scopeType === StrategyScopeType.STATIC_MARKET) {
    if (input.scopeParams) {
      return {
        scopeType,
        scopeParams: staticMarketScopeParamsSchema.parse(input.scopeParams),
      };
    }

    return {
      scopeType,
      scopeParams: staticMarketScopeParamsSchema.parse({
        marketId: input.values?.marketId ?? input.marketId,
        tokenId: input.values?.tokenId ?? input.tokenId,
      }),
    };
  }

  if (input.scopeParams) {
    return {
      scopeType,
      scopeParams: discoveryQueryScopeParamsSchema.parse(input.scopeParams),
    };
  }

  return {
    scopeType,
    scopeParams: discoveryQueryScopeParamsSchema.parse({
      maxMarketsTracked: input.values?.maxMarketsTracked,
      minLiquidity: input.values?.minLiquidity,
      minVolume24h: input.values?.minVolume24h,
      minBookDepth: input.values?.minBookDepth,
      maxSpread: input.values?.rangeMaxSpread ?? input.values?.maxSpread,
      minTimeToExpiryMinutes: input.values?.minTimeToExpiryMinutes,
    }),
  };
}

export function getStaticTarget(strategy: {
  type: StrategyType;
  scopeType?: StrategyScopeType | null;
  scopeParams: unknown;
  marketId?: string | null;
  tokenId?: string | null;
}) {
  const inferredScope = strategy.scopeType ?? defaultScopeTypeForStrategy(strategy.type);

  if (inferredScope === StrategyScopeType.STATIC_MARKET) {
    const parsed = staticMarketScopeParamsSchema.safeParse(strategy.scopeParams);
    if (parsed.success) {
      return parsed.data;
    }
  }

  if (strategy.marketId && strategy.tokenId) {
    return {
      marketId: strategy.marketId,
      tokenId: strategy.tokenId,
    };
  }

  return null;
}

export function getDiscoveryScope(strategy: {
  type: StrategyType;
  scopeType?: StrategyScopeType | null;
  scopeParams: unknown;
}) {
  const inferredScope = strategy.scopeType ?? defaultScopeTypeForStrategy(strategy.type);
  if (inferredScope !== StrategyScopeType.DISCOVERY_QUERY) {
    return null;
  }

  return discoveryQueryScopeParamsSchema.parse(strategy.scopeParams);
}
