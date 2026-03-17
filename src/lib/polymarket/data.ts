import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http/fetch-json";
import {
  dataPositionResponseSchema,
  dataTradeResponseSchema,
} from "@/lib/polymarket/types";

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(path, env.POLYMARKET_DATA_HOST);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function getRecentTrades(limit = 25) {
  return fetchJson(buildUrl("/trades", { limit }), {
    schema: dataTradeResponseSchema,
  });
}

export async function getPositions(user: string | undefined, limit = 50) {
  if (!user) {
    return [];
  }

  const positions = await fetchJson(
    buildUrl("/positions", {
      user,
      sizeThreshold: 0.01,
      limit,
    }),
    { schema: dataPositionResponseSchema },
  );

  return positions;
}

export async function savePositionSnapshots(positions: Awaited<ReturnType<typeof getPositions>>) {
  await Promise.all(
    positions.slice(0, 10).map((position) =>
      db.positionSnapshot.create({
        data: {
          marketId: String(position.market ?? position.conditionId ?? "unknown"),
          tokenId: String(position.asset ?? position.asset_id ?? "unknown"),
          source: "Data API",
          raw: toJsonValue(position),
        },
      }),
    ),
  );
}
