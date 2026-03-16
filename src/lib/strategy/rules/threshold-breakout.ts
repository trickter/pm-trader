import type { StrategySignalCandidate } from "@/lib/strategy/types";
import { thresholdBreakoutParamsSchema } from "@/lib/strategy/types";

export function evaluateThresholdBreakout(input: {
  params: unknown;
  observedPrice: number;
}): StrategySignalCandidate | null {
  const params = thresholdBreakoutParamsSchema.parse(input.params);
  const matched =
    params.comparator === "gte"
      ? input.observedPrice >= params.threshold
      : input.observedPrice <= params.threshold;

  if (!matched) {
    return null;
  }

  return {
    signalType: "PRICE_THRESHOLD",
    reason: `Observed price ${input.observedPrice} ${params.comparator} ${params.threshold}`,
    observedPrice: input.observedPrice,
  };
}
