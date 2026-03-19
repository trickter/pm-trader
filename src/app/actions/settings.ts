"use server";

import { revalidatePath } from "next/cache";

import { verifyAdminToken } from "@/lib/auth";
import { setRiskSettings, setRuntimeSettings } from "@/lib/db/settings";
import { env } from "@/lib/env";
import { getTradingScope } from "@/lib/polymarket/server-config";
import { audit } from "@/lib/risk/engine";

export async function updateRiskSettingsAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  await setRiskSettings({
    globalMaxExposure: Number(formData.get("globalMaxExposure")),
    perMarketMaxExposure: Number(formData.get("perMarketMaxExposure")),
    maxOrderSize: Number(formData.get("maxOrderSize")),
    maxDailyOrders: Number(formData.get("maxDailyOrders")),
    emergencyStop: formData.get("emergencyStop") === "on",
  });

  await audit("risk_settings_updated", "SystemSetting", undefined, undefined, "operator");
  revalidatePath("/risk");
}

export async function updateRuntimeSettingsAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  await setRuntimeSettings({
    apiHost: String(formData.get("apiHost") || env.POLYMARKET_CLOB_HOST),
    chainId: Number(formData.get("chainId") || env.POLYMARKET_CHAIN_ID),
    walletMode: getTradingScope().walletMode,
    signatureType: getTradingScope().signatureType,
    defaultDryRun: formData.get("defaultDryRun") === "on",
    maxMarketDataStalenessMs: Number(formData.get("maxMarketDataStalenessMs") || 5000),
    maxUserStateStalenessMs: Number(formData.get("maxUserStateStalenessMs") || 5000),
  });

  await audit("runtime_settings_updated", "SystemSetting", undefined, undefined, "operator");
  revalidatePath("/settings");
}
