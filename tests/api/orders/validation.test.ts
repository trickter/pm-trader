import { describe, it, expect } from "vitest";
import { z } from "zod";
import { manualOrderSchema } from "@/lib/orders/schemas";

// Test API input validation schemas
describe("API input validation", () => {
  describe("manual order validation", () => {
    it("should accept valid order input", () => {
      const validInput = {
        marketId: "123",
        tokenId: "456",
        side: "BUY",
        size: 10,
        price: 0.50,
      };

      const result = manualOrderSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject empty marketId", () => {
      const invalidInput = {
        marketId: "",
        tokenId: "456",
        side: "BUY",
        size: 10,
        price: 0.50,
      };

      const result = manualOrderSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject negative size", () => {
      const invalidInput = {
        marketId: "123",
        tokenId: "456",
        side: "BUY",
        size: -10,
        price: 0.50,
      };

      const result = manualOrderSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject price at zero (positive required)", () => {
      const invalidInput = {
        marketId: "123",
        tokenId: "456",
        side: "BUY",
        size: 10,
        price: 0,
      };

      const result = manualOrderSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject negative price", () => {
      const invalidInput = {
        marketId: "123",
        tokenId: "456",
        side: "BUY",
        size: 10,
        price: -0.1,
      };

      const result = manualOrderSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should accept price at boundary (1)", () => {
      const boundaryHigh = {
        marketId: "123",
        tokenId: "456",
        side: "BUY",
        size: 10,
        price: 1,
      };

      expect(manualOrderSchema.safeParse(boundaryHigh).success).toBe(true);
    });

    it("should reject invalid side", () => {
      const invalidInput = {
        marketId: "123",
        tokenId: "456",
        side: "HOLD", // invalid
        size: 10,
        price: 0.50,
      };

      const result = manualOrderSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("strategy creation validation", () => {
    it("should validate strategy name minimum length", () => {
      const nameSchema = z.string().min(2);
      expect(nameSchema.safeParse("A").success).toBe(false);
      expect(nameSchema.safeParse("AB").success).toBe(true);
    });

    it("should validate positive numbers", () => {
      const positiveSchema = z.number().positive();
      expect(positiveSchema.safeParse(0).success).toBe(false);
      expect(positiveSchema.safeParse(-1).success).toBe(false);
      expect(positiveSchema.safeParse(1).success).toBe(true);
    });

    it("should validate integer numbers", () => {
      const intSchema = z.number().int();
      expect(intSchema.safeParse(10.5).success).toBe(false);
      expect(intSchema.safeParse(10).success).toBe(true);
    });
  });

  describe("risk settings validation", () => {
    const riskSettingsSchema = z.object({
      globalMaxExposure: z.number().positive(),
      perMarketMaxExposure: z.number().positive(),
      maxOrderSize: z.number().positive(),
      maxDailyOrders: z.number().int().positive(),
      emergencyStop: z.boolean(),
    });

    it("should accept valid risk settings", () => {
      const validInput = {
        globalMaxExposure: 10000,
        perMarketMaxExposure: 1000,
        maxOrderSize: 100,
        maxDailyOrders: 50,
        emergencyStop: false,
      };

      const result = riskSettingsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should accept emergency stop enabled", () => {
      const validInput = {
        globalMaxExposure: 10000,
        perMarketMaxExposure: 1000,
        maxOrderSize: 100,
        maxDailyOrders: 50,
        emergencyStop: true,
      };

      const result = riskSettingsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject zero values for numeric limits", () => {
      const invalidInput = {
        globalMaxExposure: 0,
        perMarketMaxExposure: 1000,
        maxOrderSize: 100,
        maxDailyOrders: 50,
        emergencyStop: false,
      };

      const result = riskSettingsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});
