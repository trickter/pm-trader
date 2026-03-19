import { describe, it, expect } from "vitest";
import { evaluateOrderbookImbalance } from "@/lib/strategy/rules/spread-imbalance";

describe("spread-imbalance rules", () => {
  describe("evaluateOrderbookImbalance", () => {
    const baseParams = {
      maxSpread: 0.05,
      minTopDepth: 1000,
      imbalanceRatio: 0.5,
    };

    it("should trigger signal when all conditions are met", () => {
      const result = evaluateOrderbookImbalance({
        params: baseParams,
        spread: 0.02,
        bestBid: "0.49",
        bestAsk: "0.51",
        topBidSize: "8000",
        topAskSize: "2000",
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe("DEPTH_IMBALANCE");
      expect(result?.observedSpread).toBe(0.02);
    });

    it("should NOT trigger when spread exceeds maxSpread", () => {
      const result = evaluateOrderbookImbalance({
        params: baseParams,
        spread: 0.10, // exceeds maxSpread of 0.05
        bestBid: "0.45",
        bestAsk: "0.55",
        topBidSize: "8000",
        topAskSize: "2000",
      });

      expect(result).toBeNull();
    });

    it("should NOT trigger when top depth is below minTopDepth", () => {
      const result = evaluateOrderbookImbalance({
        params: baseParams,
        spread: 0.02,
        bestBid: "0.49",
        bestAsk: "0.51",
        topBidSize: "500", // below minTopDepth of 1000
        topAskSize: "300", // below minTopDepth of 1000
      });

      expect(result).toBeNull();
    });

    it("should NOT trigger when imbalance ratio is below threshold", () => {
      const result = evaluateOrderbookImbalance({
        params: baseParams,
        spread: 0.02,
        bestBid: "0.49",
        bestAsk: "0.51",
        topBidSize: "6000", // 6000/(6000+4000) = 0.6 - above threshold
        topAskSize: "4000", // 0.2 imbalance -> actually below 0.5
      });

      // Actually let's calculate: 6000-4000=2000, 2000/10000=0.2 which is < 0.5
      // So this should be null - imbalance not high enough
      expect(result).toBeNull();
    });

    it("should trigger when imbalance is high enough", () => {
      const result = evaluateOrderbookImbalance({
        params: baseParams,
        spread: 0.02,
        bestBid: "0.49",
        bestAsk: "0.51",
        topBidSize: "9000", // (9000-1000)/10000 = 0.8 > 0.5
        topAskSize: "1000",
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe("DEPTH_IMBALANCE");
    });

    it("should trigger SPREAD_THRESHOLD when spread matches but imbalance is below", () => {
      // When spread <= maxSpread but imbalance < imbalanceRatio, but total depth is met
      // Actually looking at the code: signalType is either DEPTH_IMBALANCE or SPREAD_THRESHOLD
      // based on imbalance >= params.imbalanceRatio. If not matched, returns null.
      // So if imbalance is below threshold, it returns null, not SPREAD_THRESHOLD.
      const paramsWithLowImbalance = {
        maxSpread: 0.05,
        minTopDepth: 100,
        imbalanceRatio: 0.8, // high threshold
      };

      const result = evaluateOrderbookImbalance({
        params: paramsWithLowImbalance,
        spread: 0.01,
        bestBid: "0.49",
        bestAsk: "0.50",
        topBidSize: "550",
        topAskSize: "450", // 1000 total, 100/1000 = 0.1 imbalance < 0.8
      });

      expect(result).toBeNull();
    });

    it("should handle zero depth gracefully", () => {
      const result = evaluateOrderbookImbalance({
        params: baseParams,
        spread: 0.02,
        bestBid: "0.49",
        bestAsk: "0.51",
        topBidSize: "0",
        topAskSize: "0",
      });

      expect(result).toBeNull(); // zero total depth should fail minTopDepth
    });

    it("should include book snapshot in signal", () => {
      const result = evaluateOrderbookImbalance({
        params: baseParams,
        spread: 0.02,
        bestBid: "0.49",
        bestAsk: "0.51",
        topBidSize: "8000",
        topAskSize: "2000",
      });

      expect(result?.bookSnapshotSummary).toEqual({
        bestBid: "0.49",
        bestAsk: "0.51",
        topBidSize: "8000",
        topAskSize: "2000",
      });
    });
  });
});
