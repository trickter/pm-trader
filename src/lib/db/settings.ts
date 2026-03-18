import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { TradingSignatureType, TradingWalletMode } from "@/lib/polymarket/server-config";
import { normalizeSignatureType, signatureTypeToWalletMode } from "@/lib/polymarket/server-config";

export type GlobalRiskSettings = {
  globalMaxExposure: number;
  perMarketMaxExposure: number;
  maxOrderSize: number;
  maxDailyOrders: number;
  emergencyStop: boolean;
};

export type RuntimeSettings = {
  apiHost: string;
  chainId: number;
  walletMode: TradingWalletMode;
  signatureType: TradingSignatureType;
  defaultDryRun: boolean;
  maxMarketDataStalenessMs: number;
  maxUserStateStalenessMs: number;
};

function inferWalletMode(signatureType: number): RuntimeSettings["walletMode"] {
  return signatureTypeToWalletMode(signatureType);
}

export const defaultRiskSettings: GlobalRiskSettings = {
  globalMaxExposure: 1000,
  perMarketMaxExposure: 250,
  maxOrderSize: 50,
  maxDailyOrders: 25,
  emergencyStop: false,
};

export const defaultRuntimeSettings: RuntimeSettings = {
  apiHost: env.POLYMARKET_CLOB_HOST,
  chainId: env.POLYMARKET_CHAIN_ID,
  walletMode: inferWalletMode(env.POLYMARKET_SIGNATURE_TYPE),
  signatureType: normalizeSignatureType(env.POLYMARKET_SIGNATURE_TYPE),
  defaultDryRun: env.SYSTEM_DEFAULT_DRY_RUN,
  maxMarketDataStalenessMs: 5000,
  maxUserStateStalenessMs: 5000,
};

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const setting = await db.systemSetting.findUnique({ where: { key } });
  if (!setting) {
    return fallback;
  }

  return setting.value as T;
}

export async function getRiskSettings() {
  return getSetting("risk", defaultRiskSettings);
}

export async function setRiskSettings(value: GlobalRiskSettings) {
  return db.systemSetting.upsert({
    where: { key: "risk" },
    create: { key: "risk", value },
    update: { value },
  });
}

export async function getRuntimeSettings() {
  const stored = await getSetting<Partial<RuntimeSettings>>("runtime", defaultRuntimeSettings);
  const signatureType = normalizeSignatureType(stored.signatureType ?? defaultRuntimeSettings.signatureType);

  return {
    ...defaultRuntimeSettings,
    ...stored,
    signatureType,
    walletMode: stored.walletMode ?? inferWalletMode(signatureType),
  } satisfies RuntimeSettings;
}

export async function setRuntimeSettings(value: RuntimeSettings) {
  return db.systemSetting.upsert({
    where: { key: "runtime" },
    create: { key: "runtime", value },
    update: { value },
  });
}

export async function getDashboardState() {
  const [strategiesCount, enabledStrategiesCount, latestSignals, latestOrders, latestFills] = await Promise.all([
    db.strategy.count(),
    db.strategy.count({ where: { enabled: true } }),
    db.signal.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.fill.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return {
    strategiesCount,
    enabledStrategiesCount,
    latestSignals,
    latestOrders,
    latestFills,
  };
}
