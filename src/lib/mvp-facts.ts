export const polymarketFacts = [
  {
    capability: "Gamma markets/events/search",
    officialSource: "https://docs.polymarket.com/developers/gamma-markets-api/get-markets and related Gamma API reference",
    usage: "Use public Gamma REST endpoints for market discovery, event drill-down, tags and public search.",
    requiresAuth: false,
    adoptedInMvp: true,
    uncertainty: "Tag-based filtering support is not wired until exact filter parameters are manually confirmed.",
  },
  {
    capability: "Data API trades / positions",
    officialSource: "https://docs.polymarket.com/developers/data-api/overview",
    usage: "Use public Data REST endpoints for trade tape and optional positions when a user address is supplied.",
    requiresAuth: false,
    adoptedInMvp: true,
    uncertainty: "Position payload varies by account history; only validated subset fields are rendered.",
  },
  {
    capability: "CLOB public reads",
    officialSource: "https://docs.polymarket.com/developers/CLOB/orders/get-order-book and official TS client",
    usage: "Use official TS client for orderbook, spread, best price, midpoint and last trade price reads.",
    requiresAuth: false,
    adoptedInMvp: true,
    uncertainty: "Realtime transport currently polls a server route instead of consuming WSS market channel payloads directly.",
  },
  {
    capability: "CLOB authenticated trading",
    officialSource: "https://docs.polymarket.com/developers/CLOB/authentication and @polymarket/clob-client README",
    usage: "Use official TS client with createOrDeriveApiKey() and createAndPostOrder() for EOA-only live trading.",
    requiresAuth: true,
    adoptedInMvp: true,
    uncertainty: "MVP scope excludes POLY_PROXY and POLY_GNOSIS_SAFE account modes.",
  },
  {
    capability: "CLOB cancel all open orders",
    officialSource: "Official TS client method cancelAll() and CLOB cancel endpoints in API reference",
    usage: "Expose kill-switch follow-up action to cancel all live open orders.",
    requiresAuth: true,
    adoptedInMvp: true,
    uncertainty: "No cancel-all batching UX beyond a single button.",
  },
  {
    capability: "CLOB WebSocket market channel",
    officialSource: "https://docs.polymarket.com/developers/CLOB/websocket/market-channel",
    usage: "Officially preferred for realtime market updates.",
    requiresAuth: false,
    adoptedInMvp: false,
    uncertainty: "Payload handling is left as TODO until a dedicated implementation pass validates event shapes and reconnect policy.",
  },
] as const;

export const humanConfirmationTodos = [
  "Gamma tag filter query parameters: docs should be re-checked before wiring server-side tag filtering.",
  "CLOB market channel payload handling and reconnect policy before replacing polling.",
  "Whether the chosen live account needs explicit collateral/token allowance setup through official flows before first order.",
];
