import "server-only";

import {
  AssetType,
  type Chain,
  ClobClient,
  OrderType,
  Side,
  SignatureType,
} from "@polymarket/clob-client";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  getTradingScope,
  isTradingConfigured,
  type TradingSignatureType,
} from "@/lib/polymarket/server-config";

let cachedClient: ClobClient | null = null;
let cachedApiCreds: Awaited<ReturnType<ClobClient["createOrDeriveApiKey"]>> | null = null;
let cachedResolvedSignatureType: TradingSignatureType | null = null;
let clientInitPromise: Promise<ClobClient> | null = null;
let cachedAuthStatus:
  | {
      checkedAt: number;
      ok: boolean;
      signerAddress: string | null;
      funderAddress: string | null;
      traderAddress: string | null;
      configuredSignatureType: TradingSignatureType;
      resolvedSignatureType: TradingSignatureType | null;
      error: string | null;
      attempts?: Array<{ signatureType: TradingSignatureType; error: string }>;
    }
  | null = null;

const AUTH_STATUS_TTL_MS = 60_000;

function getNormalizedPrivateKey() {
  return (
    env.POLYMARKET_PRIVATE_KEY.startsWith("0x")
      ? env.POLYMARKET_PRIVATE_KEY
      : `0x${env.POLYMARKET_PRIVATE_KEY}`
  ) as Hex;
}

function getAuthContext() {
  const privateKey = getNormalizedPrivateKey();
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(),
  });
  const tradingScope = getTradingScope();
  const configuredSignatureType = tradingScope.signatureType;

  return {
    account,
    walletClient,
    configuredSignatureType,
    funderAddress: env.POLYMARKET_FUNDER_ADDRESS || null,
    traderAddress: env.POLYMARKET_TRADER_ADDRESS || null,
  };
}

function toClientSignatureType(signatureType: TradingSignatureType) {
  if (signatureType === 2) return SignatureType.POLY_GNOSIS_SAFE;
  if (signatureType === 1) return SignatureType.POLY_PROXY;
  return SignatureType.EOA;
}

function createL1AuthClient() {
  const { walletClient } = getAuthContext();
  return new ClobClient(
    env.POLYMARKET_CLOB_HOST,
    env.POLYMARKET_CHAIN_ID as Chain,
    walletClient,
    undefined,
    undefined,
    undefined,
    undefined,
    false,
    undefined,
    undefined,
    true,
    30_000,
    true,
  );
}

async function createOrDeriveApiCredentials() {
  const client = createL1AuthClient();
  try {
    return await client.createApiKey();
  } catch (error) {
    logger.warn("polymarket create api key failed, falling back to derive", {
      error: error instanceof Error ? error.message : String(error),
    });
    return client.deriveApiKey();
  }
}

async function createClient() {
  if (!isTradingConfigured()) {
    throw new Error("Trading credentials are not configured");
  }

  const { account, walletClient, configuredSignatureType, funderAddress, traderAddress } = getAuthContext();
  let creds: Awaited<ReturnType<ClobClient["createOrDeriveApiKey"]>> | null = null;
  try {
    creds = await createOrDeriveApiCredentials();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cachedAuthStatus = {
      checkedAt: Date.now(),
      ok: false,
      signerAddress: account.address,
      funderAddress,
      traderAddress,
      configuredSignatureType,
      resolvedSignatureType: null,
      error: `Could not create or derive Polymarket API key for signer ${account.address}`,
      attempts: [{ signatureType: configuredSignatureType, error: message }],
    };

    throw new Error(
      `Polymarket L1 auth failed for signer ${account.address}.`,
    );
  }

  cachedApiCreds = creds;
  cachedResolvedSignatureType = configuredSignatureType;
  cachedAuthStatus = {
    checkedAt: Date.now(),
    ok: true,
    signerAddress: account.address,
    funderAddress,
    traderAddress,
    configuredSignatureType,
    resolvedSignatureType: configuredSignatureType,
    error: null,
  };

  return new ClobClient(
    env.POLYMARKET_CLOB_HOST,
    env.POLYMARKET_CHAIN_ID as Chain,
    walletClient,
    creds,
    toClientSignatureType(configuredSignatureType),
    funderAddress ?? undefined,
    undefined,
    false,
    undefined,
    undefined,
    true,
    30_000,
    true,
  );
}

async function getClient() {
  if (cachedClient) {
    return cachedClient;
  }

  if (!clientInitPromise) {
    clientInitPromise = createClient()
      .then((client) => {
        cachedClient = client;
        return client;
      })
      .finally(() => {
        clientInitPromise = null;
      });
  }

  return clientInitPromise;
}

export async function getOrCreateApiCredentials() {
  if (cachedApiCreds) {
    return cachedApiCreds;
  }

  await getClient();
  if (!cachedApiCreds) {
    throw new Error("Unable to derive Polymarket API credentials");
  }

  return cachedApiCreds;
}

export async function getTradingAuthStatus() {
  if (cachedAuthStatus && Date.now() - cachedAuthStatus.checkedAt < AUTH_STATUS_TTL_MS) {
    return cachedAuthStatus;
  }

  if (!isTradingConfigured()) {
    const status = {
      checkedAt: Date.now(),
      ok: false,
      signerAddress: null,
      funderAddress: env.POLYMARKET_FUNDER_ADDRESS || null,
      traderAddress: env.POLYMARKET_TRADER_ADDRESS || null,
      configuredSignatureType: getTradingScope().signatureType,
      resolvedSignatureType: null,
      error: "Trading credentials are not configured",
    };
    cachedAuthStatus = status;
    return status;
  }

  try {
    await getClient();
  } catch {
    // createClient already populated cachedAuthStatus with enriched details
  }

  if (!cachedAuthStatus) {
    const { account, configuredSignatureType, funderAddress, traderAddress } = getAuthContext();
    cachedAuthStatus = {
      checkedAt: Date.now(),
      ok: false,
      signerAddress: account.address,
      funderAddress,
      traderAddress,
      configuredSignatureType,
      resolvedSignatureType: cachedResolvedSignatureType,
      error: "Unknown Polymarket auth state",
    };
  }

  return cachedAuthStatus;
}

export async function placeLimitOrder(input: {
  tokenId: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  tickSize: "0.1" | "0.01" | "0.001" | "0.0001";
  negRisk?: boolean;
}) {
  const client = await getClient();
  return client.createAndPostOrder(
    {
      tokenID: input.tokenId,
      side: input.side === "BUY" ? Side.BUY : Side.SELL,
      size: input.size,
      price: input.price,
    },
    {
      tickSize: input.tickSize,
      negRisk: input.negRisk ?? false,
    },
    OrderType.GTC,
  );
}

export async function listOpenOrders() {
  const client = await getClient();
  return client.getOpenOrders();
}

export async function listTrades() {
  const client = await getClient();
  return client.getTrades();
}

export async function cancelOrder(orderId: string) {
  const client = await getClient();
  return client.cancelOrder({ orderID: orderId });
}

export async function cancelAllOrders() {
  const client = await getClient();
  return client.cancelAll();
}

export async function getBalanceAllowance() {
  const client = await getClient();
  return client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
}
