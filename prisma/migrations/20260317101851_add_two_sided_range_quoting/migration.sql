-- CreateEnum
CREATE TYPE "public"."StrategyType" AS ENUM ('THRESHOLD_BREAKOUT', 'ORDERBOOK_IMBALANCE', 'TWO_SIDED_RANGE_QUOTING');

-- CreateEnum
CREATE TYPE "public"."StrategySide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "public"."SignalType" AS ENUM ('PRICE_THRESHOLD', 'SPREAD_THRESHOLD', 'DEPTH_IMBALANCE', 'RANGE_ENTRY', 'RANGE_EXIT');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'SUBMITTED', 'REJECTED', 'CANCELLED', 'FILLED', 'PARTIALLY_FILLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."RiskRuleType" AS ENUM ('GLOBAL', 'PER_MARKET');

-- CreateTable
CREATE TABLE "public"."MarketCache" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "question" TEXT NOT NULL,
    "conditionId" TEXT,
    "active" BOOLEAN,
    "closed" BOOLEAN,
    "endDate" TIMESTAMP(3),
    "liquidity" DECIMAL(20,8),
    "volume" DECIMAL(20,8),
    "openInterest" DECIMAL(20,8),
    "raw" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventCache" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "active" BOOLEAN,
    "closed" BOOLEAN,
    "endDate" TIMESTAMP(3),
    "liquidity" DECIMAL(20,8),
    "volume" DECIMAL(20,8),
    "openInterest" DECIMAL(20,8),
    "raw" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Strategy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."StrategyType" NOT NULL,
    "marketId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "side" "public"."StrategySide" NOT NULL,
    "triggerParams" JSONB NOT NULL,
    "maxOrderSize" DECIMAL(20,8) NOT NULL,
    "maxDailyTradeCount" INTEGER NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSignalHash" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StrategyRun" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Signal" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "signalType" "public"."SignalType" NOT NULL,
    "side" "public"."StrategySide" NOT NULL,
    "reason" TEXT NOT NULL,
    "observedPrice" DECIMAL(20,8),
    "observedSpread" DECIMAL(20,8),
    "bookSnapshotSummary" JSONB,
    "signalHash" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT,
    "signalId" TEXT,
    "marketId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "clientOrderId" TEXT,
    "polymarketOrderId" TEXT,
    "side" "public"."StrategySide" NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "size" DECIMAL(20,8) NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Fill" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "polymarketTradeId" TEXT,
    "marketId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "side" "public"."StrategySide" NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "size" DECIMAL(20,8) NOT NULL,
    "source" TEXT NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PositionSnapshot" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RiskRule" (
    "id" TEXT NOT NULL,
    "type" "public"."RiskRuleType" NOT NULL,
    "scopeKey" TEXT,
    "params" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."MarketSuitability" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "strategyId" TEXT,
    "score" INTEGER NOT NULL,
    "priceRangeScore" INTEGER NOT NULL DEFAULT 0,
    "liquidityScore" INTEGER NOT NULL DEFAULT 0,
    "volumeScore" INTEGER NOT NULL DEFAULT 0,
    "bookDepthScore" INTEGER NOT NULL DEFAULT 0,
    "spreadScore" INTEGER NOT NULL DEFAULT 0,
    "timeToExpiry" INTEGER NOT NULL DEFAULT 0,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "snapshot" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSuitability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketSuitability_marketId_idx" ON "public"."MarketSuitability"("marketId");

-- CreateIndex
CREATE INDEX "MarketSuitability_strategyId_idx" ON "public"."MarketSuitability"("strategyId");

-- AddForeignKey
ALTER TABLE "public"."StrategyRun" ADD CONSTRAINT "StrategyRun_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Signal" ADD CONSTRAINT "Signal_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fill" ADD CONSTRAINT "Fill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
