// Realistic Gamma API response fixtures for testing
// Based on actual Polymarket gamma API response structure

export const gammaMarketFixture = {
  id: "200813137309309138538309138538090909380938",
  question: "Will Bitcoin exceed $100,000 by end of 2025?",
  conditionId: "0x1234567890abcdef1234567890abcdef12345678",
  slug: "will-bitcoin-exceed-100000-by-end-of-2025",
  endDate: "2025-12-31T23:59:59Z",
  startDate: "2024-01-01T00:00:00Z",
  liquidity: "500000.00",
  volume: "1250000.00",
  volume24hr: 45000.5,
  openInterest: "380000.00",
  active: true,
  closed: false,
  spread: 0.02,
  bestBid: 0.48,
  bestAsk: 0.50,
  lastTradePrice: 0.49,
  outcomes: "Yes,No",
  outcomePrices: '{"yes":"0.49","no":"0.51"}',
  clobTokenIds: '{"yes":"123","no":"456"}',
  orderPriceMinTickSize: 0.001,
  orderMinSize: 1,
  acceptingOrders: true,
  negRisk: false,
};

export const gammaMarketWithHighSpreadFixture = {
  ...gammaMarketFixture,
  id: "200813137309309138538309138538090909380939",
  question: "Will ETH exceed $5,000 by end of 2025?",
  slug: "will-eth-exceed-5000-by-end-of-2025",
  spread: 0.15,
  bestBid: 0.40,
  bestAsk: 0.55,
  lastTradePrice: 0.45,
};

export const gammaMarketWithLowLiquidityFixture = {
  ...gammaMarketFixture,
  id: "200813137309309138538309138538090909380940",
  question: "Will a cat be elected president by 2030?",
  slug: "will-a-cat-be-elected-president-by-2030",
  liquidity: "500.00",
  volume: "1200.00",
  openInterest: "300.00",
  spread: 0.08,
  bestBid: 0.02,
  bestAsk: 0.10,
  lastTradePrice: 0.05,
};

export const gammaEventFixture = {
  id: "200813137309309138538309138538090909380941",
  slug: "will-bitcoin-exceed-100000-by-end-of-2025",
  title: "Bitcoin Price Prediction",
  description: "Will Bitcoin exceed $100,000 by end of 2025?",
  active: true,
  closed: false,
  endDate: "2025-12-31T23:59:59Z",
  liquidity: "500000.00",
  volume: "1250000.00",
  openInterest: "380000.00",
  tags: [
    { id: "1", label: "Crypto", slug: "crypto" },
    { id: "2", label: "Price Prediction", slug: "price-prediction" },
  ],
  markets: [gammaMarketFixture],
};
