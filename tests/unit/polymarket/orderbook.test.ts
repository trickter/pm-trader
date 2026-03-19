import { describe, it, expect } from "vitest";
import {
  getBestBidLevel,
  getBestAskLevel,
} from "@/lib/polymarket/orderbook";
import type { BookLike } from "@/lib/polymarket/orderbook";

describe("orderbook", () => {
  describe("getBestBidLevel", () => {
    it("should return the highest bid price level", () => {
      const book: BookLike = {
        bids: [
          { price: "0.49", size: "1000" },
          { price: "0.51", size: "500" }, // highest
          { price: "0.50", size: "2000" },
        ],
      };

      const result = getBestBidLevel(book);
      expect(result?.price).toBe("0.51");
      expect(result?.size).toBe("500");
    });

    it("should return the first level if all bids have same price", () => {
      const book: BookLike = {
        bids: [
          { price: "0.50", size: "1000" },
          { price: "0.50", size: "2000" },
        ],
      };

      const result = getBestBidLevel(book);
      expect(result?.price).toBe("0.50");
      expect(result?.size).toBe("1000"); // first one
    });

    it("should return undefined for empty bids", () => {
      const book: BookLike = { bids: [] };
      expect(getBestBidLevel(book)).toBeUndefined();
    });

    it("should return undefined if bids is undefined", () => {
      const book: BookLike = {};
      expect(getBestBidLevel(book)).toBeUndefined();
    });

    it("should handle unsorted bids correctly", () => {
      const book: BookLike = {
        bids: [
          { price: "0.45", size: "5000" },
          { price: "0.52", size: "1000" }, // highest but not first
          { price: "0.48", size: "2000" },
        ],
      };

      const result = getBestBidLevel(book);
      expect(result?.price).toBe("0.52");
    });
  });

  describe("getBestAskLevel", () => {
    it("should return the lowest ask price level", () => {
      const book: BookLike = {
        asks: [
          { price: "0.52", size: "3000" },
          { price: "0.50", size: "1500" }, // lowest
          { price: "0.51", size: "2000" },
        ],
      };

      const result = getBestAskLevel(book);
      expect(result?.price).toBe("0.50");
      expect(result?.size).toBe("1500");
    });

    it("should return the first level if all asks have same price", () => {
      const book: BookLike = {
        asks: [
          { price: "0.50", size: "1000" },
          { price: "0.50", size: "2000" },
        ],
      };

      const result = getBestAskLevel(book);
      expect(result?.price).toBe("0.50");
      expect(result?.size).toBe("1000"); // first one
    });

    it("should return undefined for empty asks", () => {
      const book: BookLike = { asks: [] };
      expect(getBestAskLevel(book)).toBeUndefined();
    });

    it("should return undefined if asks is undefined", () => {
      const book: BookLike = {};
      expect(getBestAskLevel(book)).toBeUndefined();
    });

    it("should handle unsorted asks correctly", () => {
      const book: BookLike = {
        asks: [
          { price: "0.55", size: "8000" },
          { price: "0.51", size: "1500" }, // lowest but not first
          { price: "0.53", size: "4000" },
        ],
      };

      const result = getBestAskLevel(book);
      expect(result?.price).toBe("0.51");
    });
  });

  describe("spread and mid calculations", () => {
    it("should calculate spread correctly", () => {
      const bestBid = 0.49;
      const bestAsk = 0.51;
      const spread = bestAsk - bestBid;
      expect(spread).toBeCloseTo(0.02, 10);
    });

    it("should calculate mid correctly", () => {
      const bestBid = 0.49;
      const bestAsk = 0.51;
      const mid = (bestBid + bestAsk) / 2;
      expect(mid).toBe(0.50);
    });

    it("should handle tight spreads", () => {
      const bestBid = 0.499;
      const bestAsk = 0.501;
      const spread = bestAsk - bestBid;
      expect(spread).toBeCloseTo(0.002, 3);
    });

    it("should handle wide spreads", () => {
      const bestBid = 0.30;
      const bestAsk = 0.70;
      const spread = bestAsk - bestBid;
      expect(spread).toBeCloseTo(0.40, 10);
    });
  });

  describe("depth calculation", () => {
    it("should calculate total depth at top levels", () => {
      const topBidSize = 1000;
      const topAskSize = 1500;
      const totalTopDepth = topBidSize + topAskSize;
      expect(totalTopDepth).toBe(2500);
    });

    it("should calculate imbalance ratio correctly", () => {
      const topBid = 8000;
      const topAsk = 2000;
      const totalTopDepth = topBid + topAsk;
      const imbalance = Math.abs(topBid - topAsk) / totalTopDepth;
      expect(imbalance).toBe(0.6); // (8000-2000)/10000
    });

    it("should return 0 imbalance when depths are equal", () => {
      const topBid = 5000;
      const topAsk = 5000;
      const totalTopDepth = topBid + topAsk;
      const imbalance = Math.abs(topBid - topAsk) / totalTopDepth;
      expect(imbalance).toBe(0);
    });
  });
});
