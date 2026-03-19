import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Test database helper - resets specific tables
export async function cleanDatabase(tables: string[] = []) {
  if (tables.length === 0) {
    tables = [
      "AuditLog",
      "Fill",
      "Order",
      "Signal",
      "StrategyRun",
      "Strategy",
      "PositionSnapshot",
      "RiskRule",
      "SystemSetting",
      "SystemHealthState",
      "MarketSuitability",
      "MarketCache",
      "EventCache",
    ];
  }

  for (const table of tables) {
    try {
      await (db as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany();
    } catch {
      // Table might not exist or have deleteMany
    }
  }
}

// Create test strategy
export async function createTestStrategy(overrides: Partial<Prisma.StrategyCreateInput> = {}) {
  return db.strategy.create({
    data: {
      name: "Test Strategy",
      type: "THRESHOLD_BREAKOUT",
      scopeType: "STATIC_MARKET",
      scopeParams: {},
      side: "BUY",
      triggerParams: { threshold: 0.5, comparator: "gte" },
      maxOrderSize: 100,
      maxDailyTradeCount: 10,
      cooldownSeconds: 60,
      enabled: false,
      dryRun: true,
      ...overrides,
    },
  });
}

// Create test order
export async function createTestOrder(overrides: Partial<Prisma.OrderCreateInput> = {}) {
  return db.order.create({
    data: {
      marketId: "test-market",
      tokenId: "test-token",
      side: "BUY",
      price: 0.5,
      size: 10,
      status: "PENDING",
      dryRun: true,
      source: "test",
      ...overrides,
    },
  });
}

// Create test signal - requires a strategy to exist first
export async function createTestSignal(strategyId: string, overrides: Partial<Prisma.SignalCreateInput> = {}) {
  return db.signal.create({
    data: {
      strategy: { connect: { id: strategyId } },
      marketId: "test-market",
      tokenId: "test-token",
      signalType: "PRICE_THRESHOLD",
      side: "BUY",
      reason: "Test signal",
      signalHash: `hash-${Math.random()}`,
      ...overrides,
    },
  });
}
