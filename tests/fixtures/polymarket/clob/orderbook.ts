// Realistic CLOB orderbook response fixtures
// Based on actual Polymarket CLOB orderbook structure

export const clobOrderBookFixture = {
  market: "Will Bitcoin exceed $100,000 by end of 2025?",
  asset_id: "123",
  timestamp: "1700000000000",
  hash: "abc123def456",
  bids: [
    { price: "0.49", size: "1000" },
    { price: "0.48", size: "2500" },
    { price: "0.47", size: "5000" },
    { price: "0.46", size: "3000" },
    { price: "0.45", size: "10000" },
  ],
  asks: [
    { price: "0.51", size: "1500" },
    { price: "0.52", size: "3000" },
    { price: "0.53", size: "4000" },
    { price: "0.54", size: "2000" },
    { price: "0.55", size: "8000" },
  ],
  min_order_size: "1",
  tick_size: "0.001",
  neg_risk: false,
  last_trade_price: "0.50",
};

export const clobOrderBookTightSpreadFixture = {
  ...clobOrderBookFixture,
  asset_id: "456",
  bids: [
    { price: "0.499", size: "5000" },
    { price: "0.498", size: "8000" },
    { price: "0.497", size: "12000" },
  ],
  asks: [
    { price: "0.501", size: "6000" },
    { price: "0.502", size: "9000" },
    { price: "0.503", size: "15000" },
  ],
  tick_size: "0.001",
  last_trade_price: "0.500",
};

export const clobOrderBookWideSpreadFixture = {
  ...clobOrderBookFixture,
  asset_id: "789",
  bids: [
    { price: "0.35", size: "500" },
    { price: "0.30", size: "1000" },
  ],
  asks: [
    { price: "0.65", size: "800" },
    { price: "0.70", size: "1500" },
  ],
  tick_size: "0.01",
  last_trade_price: "0.50",
};

export const clobOrderBookImbalancedFixture = {
  ...clobOrderBookFixture,
  asset_id: "999",
  bids: [
    { price: "0.49", size: "50000" },
    { price: "0.48", size: "30000" },
    { price: "0.47", size: "20000" },
  ],
  asks: [
    { price: "0.51", size: "500" },
    { price: "0.52", size: "1000" },
  ],
};
