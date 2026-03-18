import "server-only";

import { env } from "@/lib/env";

export type TradingWalletMode = "EOA" | "POLY_PROXY" | "POLY_GNOSIS_SAFE";
export type TradingSignatureType = 0 | 1 | 2;

export function normalizeSignatureType(value: number): TradingSignatureType {
  if (value === 1 || value === 2) {
    return value;
  }
  return 0;
}

export function signatureTypeToWalletMode(signatureType: number): TradingWalletMode {
  const normalized = normalizeSignatureType(signatureType);
  if (normalized === 1) {
    return "POLY_PROXY";
  }
  return normalized === 2 ? "POLY_GNOSIS_SAFE" : "EOA";
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
