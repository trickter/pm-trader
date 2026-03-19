import type { GammaMarket, ClobOrderBook, DataPosition, DataTrade } from "@/lib/polymarket/types";
import { gammaMarketFixture } from "../fixtures/polymarket/gamma/market";
import { clobOrderBookFixture } from "../fixtures/polymarket/clob/orderbook";
import { dataPositionFixture, dataTradeFixture } from "../fixtures/polymarket/data/positions";

export function createMarket(overrides: Partial<GammaMarket> = {}): GammaMarket {
  return { ...gammaMarketFixture, ...overrides } as GammaMarket;
}

export function createOrderBook(overrides: Partial<ClobOrderBook> = {}): ClobOrderBook {
  return { ...clobOrderBookFixture, ...overrides } as ClobOrderBook;
}

export function createPosition(overrides: Partial<DataPosition> = {}): DataPosition {
  return { ...dataPositionFixture, ...overrides } as DataPosition;
}

export function createTrade(overrides: Partial<DataTrade> = {}): DataTrade {
  return { ...dataTradeFixture, ...overrides } as DataTrade;
}
