import "server-only";

import { env } from "@/lib/env";

export type TradingWalletMode = "EOA" | "POLY_GNOSIS_SAFE";

export function normalizeSignatureType(value: number) {
  return value === 2 ? 2 : 0;
}

export function signatureTypeToWalletMode(signatureType: number): TradingWalletMode {
  return normalizeSignatureType(signatureType) === 2 ? "POLY_GNOSIS_SAFE" : "EOA";
}

export function isTradingConfigured() {
  return Boolean(env.POLYMARKET_PRIVATE_KEY) && Boolean(env.POLYMARKET_FUNDER_ADDRESS);
}

export function getTradingScope() {
  const signatureType = normalizeSignatureType(env.POLYMARKET_SIGNATURE_TYPE);
  return {
    chainId: env.POLYMARKET_CHAIN_ID,
    signatureType,
    walletMode: signatureTypeToWalletMode(signatureType),
  };
}
