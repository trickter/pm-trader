import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getRiskSettings } from "@/lib/db/settings";
import { getPositions } from "@/lib/polymarket/data";
import { assertTradingAllowedForExecution } from "@/lib/trading/readiness";

export async function assertRiskBeforeOrder(input: {
  strategyId: string;
  conditionId: string;
  size: number;
  signalHash: string;
  signalId?: string;
  traderAddress?: string;
}) {
  const [settings, strategy, dailyOrderCount, duplicateSignal, positions] = await Promise.all([
    getRiskSettings(),
    db.strategy.findUniqueOrThrow({ where: { id: input.strategyId } }),
    db.order.count({
      where: {
        strategyId: input.strategyId,
        createdAt: {
          gte: new Date(new Date().setUTCHours(0, 0, 0, 0)),
        },
      },
    }),
    // Check for ANY existing signal with this hash, not just executed ones.
    // Checking only `executed: true` leaves a race window where two concurrent
    // runs both pass the check before either marks the signal as executed.
    db.signal.findFirst({
      where: {
        strategyId: input.strategyId,
        signalHash: input.signalHash,
        id: input.signalId ? { not: input.signalId } : undefined,
      },
      orderBy: { createdAt: "desc" },
    }),
    getPositions(input.traderAddress),
  ]);

  if (settings.emergencyStop) {
    throw new Error("Global emergency stop is enabled");
  }

  await assertTradingAllowedForExecution({
    conditionId: input.conditionId,
  });

  if (input.size > settings.maxOrderSize || input.size > Number(strategy.maxOrderSize)) {
    throw new Error("Order size exceeds risk limit");
  }

  if (dailyOrderCount >= settings.maxDailyOrders || dailyOrderCount >= strategy.maxDailyTradeCount) {
    throw new Error("Daily order limit reached");
  }

  if (duplicateSignal) {
    throw new Error("Duplicate signal already exists");
  }

  if (strategy.lastTriggeredAt) {
    const cooldownEndsAt = strategy.lastTriggeredAt.getTime() + strategy.cooldownSeconds * 1000;
    if (Date.now() < cooldownEndsAt) {
      throw new Error("Strategy cooldown is active");
    }
  }

  const estimatedExposure = positions.reduce((sum, position) => {
    const currentValue = Number(position.currentValue ?? position.size ?? 0);
    return sum + currentValue;
  }, 0);

  if (estimatedExposure + input.size > settings.globalMaxExposure) {
    throw new Error("Global max exposure breached");
  }

  const marketExposure = positions
    .filter((position) => String(position.conditionId ?? "") === input.conditionId)
    .reduce((sum, position) => sum + Number(position.currentValue ?? position.size ?? 0), 0);

  if (marketExposure + input.size > settings.perMarketMaxExposure) {
    throw new Error("Per-market max exposure breached");
  }
}

export async function assertManualRisk(input: {
  conditionId: string;
  size: number;
  traderAddress?: string;
}) {
  const [settings, positions] = await Promise.all([
    getRiskSettings(),
    getPositions(input.traderAddress),
  ]);

  if (settings.emergencyStop) {
    throw new Error("Global emergency stop is enabled");
  }

  await assertTradingAllowedForExecution({
    conditionId: input.conditionId,
  });

  if (input.size > settings.maxOrderSize) {
    throw new Error("Order size exceeds global risk limit");
  }

  const estimatedExposure = positions.reduce((sum, position) => {
    const currentValue = Number(position.currentValue ?? position.size ?? 0);
    return sum + currentValue;
  }, 0);

  if (estimatedExposure + input.size > settings.globalMaxExposure) {
    throw new Error("Global max exposure breached");
  }

  const marketExposure = positions
    .filter((position) => String(position.conditionId ?? "") === input.conditionId)
    .reduce((sum, position) => sum + Number(position.currentValue ?? position.size ?? 0), 0);

  if (marketExposure + input.size > settings.perMarketMaxExposure) {
    throw new Error("Per-market max exposure breached");
  }
}

export async function audit(action: string, entityType: string, entityId?: string, payload?: Prisma.InputJsonValue, actor?: string) {
  const enrichedPayload: Record<string, unknown> = {
    ...(typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload : payload !== undefined ? { _value: payload } : {}),
    ...(actor ? { actor } : {}),
  };

  await db.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      payload: Object.keys(enrichedPayload).length > 0 ? (enrichedPayload as Prisma.InputJsonValue) : undefined,
    },
  });
}
