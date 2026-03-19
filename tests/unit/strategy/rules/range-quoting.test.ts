import { describe, it, expect } from "vitest";
import { evaluateRangeEntry, evaluateRangeExit } from "@/lib/strategy/rules/range-quoting";

const baseParams = {
  entryLow: 0.40,
  entryHigh: 0.60,
  exitLow: 0.30,
  exitHigh: 0.70,
  orderSize: 10,
  maxInventoryPerSide: 100,
  maxInventoryPerMarket: 200,
  maxOpenOrdersPerSide: 2,
  maxSpread: 0.05,
  minTopLevelSize: 0,
  maxQuoteAgeMs: 5000,
  trendFilterEnabled: true,
  trendFilterThreshold: 0.10,
  allowBothSidesInventory: true,
};

describe("range-quoting rules", () => {
  describe("evaluateRangeEntry", () => {
    it("should trigger RANGE_ENTRY when mid price is within entry band", () => {
      const result = evaluateRangeEntry({
        params: baseParams,
        bestBid: 0.49,
        bestAsk: 0.51,
        midPrice: 0.50,
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe("RANGE_ENTRY");
      expect(result?.side).toBe("BUY");
      expect(result?.observedPrice).toBeGreaterThan(0);
      expect(result?.reason).toContain("entry band");
    });

    it("should NOT trigger when inventory is at max per side", () => {
      const result = evaluateRangeEntry({
        params: baseParams,
        bestBid: 0.49,
        bestAsk: 0.51,
        midPrice: 0.50,
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 100, // at maxInventoryPerSide
        maxInventoryPerSide: 100,
      });

      expect(result).toBeNull();
    });

    it("should NOT trigger when spread exceeds maxSpread", () => {
      const result = evaluateRangeEntry({
        params: baseParams,
        bestBid: 0.40,
        bestAsk: 0.60,
        midPrice: 0.50,
        spread: 0.20, // exceeds maxSpread of 0.05
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      expect(result).toBeNull();
    });

    it("should NOT trigger when mid price is below entry band", () => {
      const result = evaluateRangeEntry({
        params: baseParams,
        bestBid: 0.35,
        bestAsk: 0.37,
        midPrice: 0.36, // below entryLow of 0.40
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      expect(result).toBeNull();
    });

    it("should NOT trigger when mid price is above entry band", () => {
      const result = evaluateRangeEntry({
        params: baseParams,
        bestBid: 0.65,
        bestAsk: 0.67,
        midPrice: 0.66, // above entryHigh of 0.60
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      expect(result).toBeNull();
    });

    it("should clamp entry price to entry band", () => {
      const result = evaluateRangeEntry({
        params: baseParams,
        bestBid: 0.38, // bestBid + tick would be below entryLow
        bestAsk: 0.60,
        midPrice: 0.50,
        spread: 0.02, // within maxSpread
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      expect(result).not.toBeNull();
      expect(result!.observedPrice).toBeGreaterThanOrEqual(baseParams.entryLow);
      expect(result!.observedPrice).toBeLessThanOrEqual(baseParams.entryHigh);
    });

    it("should trigger at exact entryLow boundary", () => {
      const result = evaluateRangeEntry({
        params: baseParams,
        bestBid: 0.399,
        bestAsk: 0.41,
        midPrice: 0.40, // exactly at entryLow
        spread: 0.011,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe("RANGE_ENTRY");
    });

    it("should trigger at exact entryHigh boundary", () => {
      const result = evaluateRangeEntry({
        params: baseParams,
        bestBid: 0.59,
        bestAsk: 0.601,
        midPrice: 0.60, // exactly at entryHigh
        spread: 0.011,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe("RANGE_ENTRY");
    });
  });

  describe("evaluateRangeExit", () => {
    it("should trigger RANGE_EXIT when inventory exists and mid price is in exit band", () => {
      const result = evaluateRangeExit({
        params: baseParams,
        bestBid: 0.35,
        bestAsk: 0.37,
        midPrice: 0.36,
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 50,
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe("RANGE_EXIT");
      expect(result?.side).toBe("SELL");
    });

    it("should NOT trigger when inventory is zero", () => {
      const result = evaluateRangeExit({
        params: baseParams,
        bestBid: 0.35,
        bestAsk: 0.37,
        midPrice: 0.36,
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
      });

      expect(result).toBeNull();
    });

    it("should NOT trigger when inventory is negative", () => {
      const result = evaluateRangeExit({
        params: baseParams,
        bestBid: 0.35,
        bestAsk: 0.37,
        midPrice: 0.36,
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: -10, // negative (short position)
      });

      expect(result).toBeNull();
    });

    it("should NOT trigger when mid price is below exit band", () => {
      const result = evaluateRangeExit({
        params: baseParams,
        bestBid: 0.25,
        bestAsk: 0.28,
        midPrice: 0.265, // below exitLow of 0.30
        spread: 0.03,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 50,
      });

      expect(result).toBeNull();
    });

    it("should NOT trigger when mid price is above exit band", () => {
      const result = evaluateRangeExit({
        params: baseParams,
        bestBid: 0.75,
        bestAsk: 0.78,
        midPrice: 0.765, // above exitHigh of 0.70
        spread: 0.03,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 50,
      });

      expect(result).toBeNull();
    });

    it("should clamp exit price to exit band", () => {
      const result = evaluateRangeExit({
        params: baseParams,
        bestBid: 0.35,
        bestAsk: 0.75, // bestAsk - tick would be above exitHigh
        midPrice: 0.55,
        spread: 0.40,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 50,
      });

      expect(result).not.toBeNull();
      expect(result!.observedPrice).toBeGreaterThanOrEqual(baseParams.exitLow);
      expect(result!.observedPrice).toBeLessThanOrEqual(baseParams.exitHigh);
    });
  });

  describe("entry and exit separation", () => {
    it("should only trigger ENTRY when mid is in entry but not exit band", () => {
      const entryOnlyParams = {
        entryLow: 0.45,
        entryHigh: 0.55,
        exitLow: 0.20,
        exitHigh: 0.30,
        orderSize: 10,
        maxInventoryPerSide: 100,
        maxInventoryPerMarket: 200,
        maxOpenOrdersPerSide: 2,
        maxSpread: 0.05,
        minTopLevelSize: 0,
        maxQuoteAgeMs: 5000,
        trendFilterEnabled: true,
        trendFilterThreshold: 0.10,
        allowBothSidesInventory: true,
      };

      const entryResult = evaluateRangeEntry({
        params: entryOnlyParams,
        bestBid: 0.49,
        bestAsk: 0.51,
        midPrice: 0.50,
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      const exitResult = evaluateRangeExit({
        params: entryOnlyParams,
        bestBid: 0.49,
        bestAsk: 0.51,
        midPrice: 0.50,
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 50,
      });

      expect(entryResult).not.toBeNull();
      expect(exitResult).toBeNull(); // mid 0.50 is not in exit band [0.20, 0.30]
    });

    it("should only trigger EXIT when mid is in exit but not entry band", () => {
      const exitOnlyParams = {
        entryLow: 0.70,
        entryHigh: 0.90,
        exitLow: 0.30,
        exitHigh: 0.50,
        orderSize: 10,
        maxInventoryPerSide: 100,
        maxInventoryPerMarket: 200,
        maxOpenOrdersPerSide: 2,
        maxSpread: 0.05,
        minTopLevelSize: 0,
        maxQuoteAgeMs: 5000,
        trendFilterEnabled: true,
        trendFilterThreshold: 0.10,
        allowBothSidesInventory: true,
      };

      const entryResult = evaluateRangeEntry({
        params: exitOnlyParams,
        bestBid: 0.34,
        bestAsk: 0.36,
        midPrice: 0.35,
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      const exitResult = evaluateRangeExit({
        params: exitOnlyParams,
        bestBid: 0.34,
        bestAsk: 0.36,
        midPrice: 0.35,
        spread: 0.02,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 50,
      });

      expect(entryResult).toBeNull(); // mid 0.35 is not in entry band [0.70, 0.90]
      expect(exitResult).not.toBeNull();
    });
  });
});
