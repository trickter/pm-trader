/**
 * TODO(polymarket-wss):
 * Official docs recommend the CLOB WebSocket market channel for real-time market data.
 * This MVP keeps market-data transport isolated behind a server route and currently
 * refreshes quotes via polling because the exact payload handling and reconnection
 * flow still need a dedicated implementation review before shipping.
 */
export const wsTodo = {
  officialSource: "https://docs.polymarket.com/developers/CLOB/websocket/wss-overview",
  recommendedChannel: "market",
  status: "pending",
} as const;
