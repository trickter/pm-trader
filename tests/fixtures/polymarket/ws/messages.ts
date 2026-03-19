// Realistic WebSocket message fixtures
// Based on actual Polymarket WebSocket message structure

export const marketWsBookMessageFixture = {
  event_type: "book",
  asset_id: "123",
  market: "Will Bitcoin exceed $100,000 by end of 2025?",
  bids: [
    { price: "0.49", size: "1000" },
    { price: "0.48", size: "2500" },
  ],
  asks: [
    { price: "0.51", size: "1500" },
    { price: "0.52", size: "3000" },
  ],
  hash: "book_hash_123",
  timestamp: "1700000000000",
  min_order_size: "1",
  tick_size: "0.001",
  neg_risk: false,
  last_trade_price: "0.50",
};

export const marketWsPriceChangeMessageFixture = {
  event_type: "price_change",
  market: "Will Bitcoin exceed $100,000 by end of 2025?",
  asset_id: "123",
  changes: [
    {
      asset_id: "123",
      price: "0.51",
      size: "500",
      side: "BUY",
      hash: "change_hash_456",
      best_bid: "0.49",
      best_ask: "0.51",
    },
  ],
  timestamp: "1700000001000",
};

export const marketWsLastTradeMessageFixture = {
  event_type: "last_trade_price",
  asset_id: "123",
  market: "Will Bitcoin exceed $100,000 by end of 2025?",
  price: "0.505",
  side: "BUY",
  size: "100",
  fee_rate_bps: "10",
  timestamp: "1700000002000",
};

export const marketWsBestBidAskMessageFixture = {
  event_type: "best_bid_ask",
  asset_id: "123",
  market: "Will Bitcoin exceed $100,000 by end of 2025?",
  best_bid: "0.49",
  best_ask: "0.51",
  spread: "0.02",
  timestamp: "1700000003000",
};

export const userWsOrderMessageFixture = {
  event_type: "order",
  id: "order_123",
  market: "Will Bitcoin exceed $100,000 by end of 2025?",
  asset_id: "123",
  side: "BUY",
  original_size: "10",
  size_matched: "0",
  price: "0.50",
  status: "OPEN",
  associate_trades: null,
  outcome: "Yes",
  order_owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
};

export const userWsTradeMessageFixture = {
  event_type: "trade",
  id: "trade_123",
  market: "Will Bitcoin exceed $100,000 by end of 2025?",
  asset_id: "123",
  side: "BUY",
  size: "5",
  price: "0.50",
  status: "FILLED",
  timestamp: "1700000004000",
  last_update: "1700000004000",
  taker_order_id: "order_123",
  trade_owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  maker_orders: [
    {
      order_id: "maker_order_456",
      asset_id: "123",
      matched_amount: "5",
      price: "0.50",
      owner: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      maker_address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      outcome: "Yes",
      side: "SELL",
    },
  ],
  type: "TAKER",
};
