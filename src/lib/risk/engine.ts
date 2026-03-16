import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getRiskSettings } from "@/lib/db/settings";
import { getPositions } from "@/lib/polymarket/data";

export async function assertRiskBeforeOrder(input: {
  strategyId: string;
  marketId: string;
  size: number;
  signalHash: string;
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
    db.signal.findFirst({
      where: {
        strategyId: input.strategyId,
        signalHash: input.signalHash,
        executed: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    getPositions(input.traderAddress),
  ]);

  if (settings.emergencyStop) {
    throw new Error("Global emergency stop is enabled");
  }

  if (input.size > settings.maxOrderSize || input.size > Number(strategy.maxOrderSize)) {
    throw new Error("Order size exceeds risk limit");
  }

  if (dailyOrderCount >= settings.maxDailyOrders || dailyOrderCount >= strategy.maxDailyTradeCount) {
    throw new Error("Daily order limit reached");
  }

  if (duplicateSignal) {
    throw new Error("Duplicate signal already executed");
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
    .filter((position) => String(position.conditionId ?? position.market) === input.marketId)
    .reduce((sum, position) => sum + Number(position.currentValue ?? position.size ?? 0), 0);

  if (marketExposure + input.size > settings.perMarketMaxExposure) {
    throw new Error("Per-market max exposure breached");
  }
}

export async function assertManualRisk(input: {
  marketId: string;
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
    .filter((position) => String(position.conditionId ?? position.market) === input.marketId)
    .reduce((sum, position) => sum + Number(position.currentValue ?? position.size ?? 0), 0);

  if (marketExposure + input.size > settings.perMarketMaxExposure) {
    throw new Error("Per-market max exposure breached");
  }
}

export async function audit(action: string, entityType: string, entityId?: string, payload?: Prisma.InputJsonValue) {
  await db.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      payload,
    },
  });
}
