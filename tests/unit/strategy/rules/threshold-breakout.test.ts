import { describe, it, expect } from "vitest";
import { evaluateThresholdBreakout } from "@/lib/strategy/rules/threshold-breakout";

describe("threshold-breakout rules", () => {
  describe("evaluateThresholdBreakout", () => {
    const baseParams = {
      threshold: 0.5,
      comparator: "gte" as const,
    };

    it("should trigger signal when price >= threshold with gte comparator", () => {
      const result = evaluateThresholdBreakout({
        params: baseParams,
        observedPrice: 0.55,
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe("PRICE_THRESHOLD");
      expect(result?.observedPrice).toBe(0.55);
      expect(result?.reason).toContain("gte");
      expect(result?.reason).toContain("0.55");
    });

    it("should trigger signal when price equals threshold with gte comparator", () => {
      const result = evaluateThresholdBreakout({
        params: baseParams,
        observedPrice: 0.5,
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe("PRICE_THRESHOLD");
    });

    it("should not trigger signal when price < threshold with gte comparator", () => {
      const result = evaluateThresholdBreakout({
        params: baseParams,
        observedPrice: 0.45,
      });

      expect(result).toBeNull();
    });

    it("should trigger signal when price <= threshold with lte comparator", () => {
      const lteParams = { threshold: 0.5, comparator: "lte" as const };
      const result = evaluateThresholdBreakout({
        params: lteParams,
        observedPrice: 0.40,
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe("PRICE_THRESHOLD");
      expect(result?.reason).toContain("lte");
      expect(result?.reason).toContain("0.4");
    });

    it("should trigger signal when price equals threshold with lte comparator", () => {
      const lteParams = { threshold: 0.5, comparator: "lte" as const };
      const result = evaluateThresholdBreakout({
        params: lteParams,
        observedPrice: 0.5,
      });

      expect(result).not.toBeNull();
    });

    it("should not trigger signal when price > threshold with lte comparator", () => {
      const lteParams = { threshold: 0.5, comparator: "lte" as const };
      const result = evaluateThresholdBreakout({
        params: lteParams,
        observedPrice: 0.55,
      });

      expect(result).toBeNull();
    });

    it("should handle edge case at price 0", () => {
      const zeroThresholdParams = { threshold: 0, comparator: "gte" as const };
      const result = evaluateThresholdBreakout({
        params: zeroThresholdParams,
        observedPrice: 0,
      });

      expect(result).not.toBeNull();
    });

    it("should handle edge case at price 1", () => {
      const fullThresholdParams = { threshold: 1, comparator: "lte" as const };
      const result = evaluateThresholdBreakout({
        params: fullThresholdParams,
        observedPrice: 1,
      });

      expect(result).not.toBeNull();
    });

    it("should throw on invalid params", () => {
      expect(() =>
        evaluateThresholdBreakout({
          params: { threshold: "invalid" },
          observedPrice: 0.5,
        })
      ).toThrow();
    });
  });
});
