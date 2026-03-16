import "server-only";

import { env } from "@/lib/env";

export function isTradingConfigured() {
  return Boolean(env.POLYMARKET_PRIVATE_KEY);
}

export function getTradingScope() {
  return {
    chainId: env.POLYMARKET_CHAIN_ID,
    signatureType: env.POLYMARKET_SIGNATURE_TYPE,
    walletMode: "EOA" as const,
  };
}
