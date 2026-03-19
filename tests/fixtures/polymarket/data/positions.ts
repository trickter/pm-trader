// Realistic Polymarket data API response fixtures
// Based on actual Polymarket positions and trades structure

export const dataPositionFixture = {
  proxyWallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  asset: "123",
  asset_id: "123",
  conditionId: "0x1234567890abcdef1234567890abcdef12345678",
  size: 100,
  avgPrice: "0.45",
  currentValue: "45.00",
  title: "Will Bitcoin exceed $100,000 by end of 2025?",
  slug: "will-bitcoin-exceed-100000-by-end-of-2025",
  icon: "https://polymarket.com/icons/btc.png",
  eventId: "200813137309309138538309138538090909380941",
  eventSlug: "will-bitcoin-exceed-100000-by-end-of-2025",
  outcome: "Yes",
  outcomeIndex: "0",
  oppositeOutcome: "No",
  oppositeAsset: "456",
  endDate: "2025-12-31T23:59:59Z",
  redeemable: true,
  mergeable: false,
  negativeRisk: false,
};

export const dataPositionNoOutcomeFixture = {
  ...dataPositionFixture,
  asset: "456",
  asset_id: "456",
  outcome: "No",
  outcomeIndex: "1",
  oppositeOutcome: "Yes",
  oppositeAsset: "123",
  size: 50,
  avgPrice: "0.52",
  currentValue: "26.00",
};

export const dataTradeFixture = {
  proxyWallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  side: "BUY" as const,
  asset: "123",
  conditionId: "0x1234567890abcdef1234567890abcdef12345678",
  size: 10,
  price: 0.45,
  timestamp: 1700000000,
  title: "Will Bitcoin exceed $100,000 by end of 2025?",
  slug: "will-bitcoin-exceed-100000-by-end-of-2025",
  eventSlug: "will-bitcoin-exceed-100000-by-end-of-2025",
  outcome: "Yes",
  transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
};

export const dataTradeSellFixture = {
  ...dataTradeFixture,
  side: "SELL" as const,
  size: 5,
  price: 0.52,
};
