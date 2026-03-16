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
import { isTradingConfigured } from "@/lib/polymarket/server-config";

let cachedClient: ClobClient | null = null;

async function createClient() {
  if (!isTradingConfigured()) {
    throw new Error("Trading credentials are not configured");
  }

  const privateKey = (
    env.POLYMARKET_PRIVATE_KEY.startsWith("0x")
      ? env.POLYMARKET_PRIVATE_KEY
      : `0x${env.POLYMARKET_PRIVATE_KEY}`
  ) as Hex;

  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(),
  });

  const creds = await new ClobClient(
    env.POLYMARKET_CLOB_HOST,
    env.POLYMARKET_CHAIN_ID as Chain,
    walletClient,
  ).createOrDeriveApiKey();

  return new ClobClient(
    env.POLYMARKET_CLOB_HOST,
    env.POLYMARKET_CHAIN_ID as Chain,
    walletClient,
    creds,
    SignatureType.EOA,
    env.POLYMARKET_FUNDER_ADDRESS || undefined,
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
  if (!cachedClient) {
    cachedClient = await createClient();
  }
  return cachedClient;
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
