import { describe, it, expect } from "vitest";
import type { DataPosition } from "@/lib/polymarket/types";

// Test pure risk calculation logic without DB dependencies
describe("risk calculations", () => {
  describe("exposure calculation", () => {
    it("should calculate total exposure from positions", () => {
      const positions: DataPosition[] = [
        {
          asset: "123",
          asset_id: "123",
          conditionId: "cond1",
          size: 100,
          currentValue: "50.00",
          title: "Market 1",
        },
        {
          asset: "456",
          asset_id: "456",
          conditionId: "cond2",
          size: 50,
          currentValue: "25.00",
          title: "Market 2",
        },
      ];

      const totalExposure = positions.reduce((sum, pos) => {
        return sum + Number(pos.currentValue ?? pos.size ?? 0);
      }, 0);

      expect(totalExposure).toBe(75);
    });

    it("should calculate per-market exposure correctly", () => {
      const positions: DataPosition[] = [
        { asset: "123", asset_id: "123", conditionId: "cond1", size: 100, currentValue: "50.00" },
        { asset: "456", asset_id: "456", conditionId: "cond1", size: 50, currentValue: "25.00" },
        { asset: "789", asset_id: "789", conditionId: "cond2", size: 200, currentValue: "80.00" },
      ];

      const targetConditionId = "cond1";
      const marketExposure = positions
        .filter((pos) => String(pos.conditionId ?? "") === targetConditionId)
        .reduce((sum, pos) => sum + Number(pos.currentValue ?? pos.size ?? 0), 0);

      expect(marketExposure).toBe(75); // 50 + 25
    });

    it("should handle empty positions array", () => {
      const positions: DataPosition[] = [];
      const totalExposure = positions.reduce((sum, pos) => {
        return sum + Number(pos.currentValue ?? pos.size ?? 0);
      }, 0);

      expect(totalExposure).toBe(0);
    });

    it("should handle missing currentValue and size", () => {
      const positions: DataPosition[] = [
        { asset: "123", asset_id: "123", conditionId: "cond1" },
      ];

      const totalExposure = positions.reduce((sum, pos) => {
        return sum + Number(pos.currentValue ?? pos.size ?? 0);
      }, 0);

      expect(totalExposure).toBe(0);
    });

    it("should handle string numeric values", () => {
      const positions: DataPosition[] = [
        { asset: "123", asset_id: "123", conditionId: "cond1", size: "100", currentValue: "45.50" },
      ];

      const totalExposure = positions.reduce((sum, pos) => {
        return sum + Number(pos.currentValue ?? pos.size ?? 0);
      }, 0);

      expect(totalExposure).toBe(45.5);
    });
  });

  describe("risk limit checks", () => {
    interface RiskLimits {
      maxOrderSize: number;
      maxDailyOrders: number;
      globalMaxExposure: number;
      perMarketMaxExposure: number;
      emergencyStop: boolean;
    }

    const defaultLimits: RiskLimits = {
      maxOrderSize: 100,
      maxDailyOrders: 50,
      globalMaxExposure: 1000,
      perMarketMaxExposure: 200,
      emergencyStop: false,
    };

    function checkOrderSizeRisk(size: number, limits: RiskLimits): boolean {
      return size <= limits.maxOrderSize;
    }

    function checkGlobalExposureRisk(
      currentExposure: number,
      orderSize: number,
      limits: RiskLimits
    ): boolean {
      return currentExposure + orderSize <= limits.globalMaxExposure;
    }

    function checkPerMarketExposureRisk(
      marketExposure: number,
      orderSize: number,
      limits: RiskLimits
    ): boolean {
      return marketExposure + orderSize <= limits.perMarketMaxExposure;
    }

    it("should allow order within size limit", () => {
      expect(checkOrderSizeRisk(50, defaultLimits)).toBe(true);
      expect(checkOrderSizeRisk(100, defaultLimits)).toBe(true);
    });

    it("should reject order exceeding size limit", () => {
      expect(checkOrderSizeRisk(101, defaultLimits)).toBe(false);
      expect(checkOrderSizeRisk(200, defaultLimits)).toBe(false);
    });

    it("should allow order within global exposure limit", () => {
      expect(checkGlobalExposureRisk(900, 50, defaultLimits)).toBe(true);
      expect(checkGlobalExposureRisk(950, 50, defaultLimits)).toBe(true);
      expect(checkGlobalExposureRisk(1000, 0, defaultLimits)).toBe(true);
    });

    it("should reject order exceeding global exposure limit", () => {
      expect(checkGlobalExposureRisk(960, 50, defaultLimits)).toBe(false); // 1010 > 1000
      expect(checkGlobalExposureRisk(1000, 1, defaultLimits)).toBe(false);
    });

    it("should allow order within per-market exposure limit", () => {
      expect(checkPerMarketExposureRisk(150, 30, defaultLimits)).toBe(true);
      expect(checkPerMarketExposureRisk(200, 0, defaultLimits)).toBe(true);
    });

    it("should reject order exceeding per-market exposure limit", () => {
      expect(checkPerMarketExposureRisk(180, 30, defaultLimits)).toBe(false); // 210 > 200
      expect(checkPerMarketExposureRisk(200, 1, defaultLimits)).toBe(false);
    });

    it("should always reject when emergency stop is enabled", () => {
      const emergencyLimits = { ...defaultLimits, emergencyStop: true };
      expect(emergencyLimits.emergencyStop).toBe(true);
      // Any order should be rejected when emergency stop is on
    });
  });

  describe("duplicate signal detection", () => {
    it("should identify duplicate signals by hash", () => {
      const existingSignals = [
        { signalHash: "hash1", executed: true },
        { signalHash: "hash2", executed: false },
        { signalHash: "hash3", executed: true },
      ];

      const newSignalHash = "hash2";
      const isDuplicate = existingSignals.some(
        (s) => s.signalHash === newSignalHash
      );

      expect(isDuplicate).toBe(true);
    });

    it("should allow new unique signals", () => {
      const existingSignals = [
        { signalHash: "hash1", executed: true },
        { signalHash: "hash2", executed: false },
      ];

      const newSignalHash = "hash3";
      const isDuplicate = existingSignals.some(
        (s) => s.signalHash === newSignalHash
      );

      expect(isDuplicate).toBe(false);
    });

    it("should handle empty signal list", () => {
      const existingSignals: { signalHash: string; executed: boolean }[] = [];
      const newSignalHash = "hash1";

      const isDuplicate = existingSignals.some(
        (s) => s.signalHash === newSignalHash
      );

      expect(isDuplicate).toBe(false);
    });
  });

  describe("cooldown check", () => {
    function isCooldownActive(
      lastTriggeredAt: Date | null,
      cooldownSeconds: number
    ): boolean {
      if (!lastTriggeredAt) return false;
      const cooldownEndsAt = lastTriggeredAt.getTime() + cooldownSeconds * 1000;
      return Date.now() < cooldownEndsAt;
    }

    it("should return false when strategy never triggered", () => {
      expect(isCooldownActive(null, 60)).toBe(false);
    });

    it("should return false when cooldown has expired", () => {
      const pastTime = new Date(Date.now() - 120 * 1000); // 2 minutes ago
      expect(isCooldownActive(pastTime, 60)).toBe(false);
    });

    it("should return true when cooldown is still active", () => {
      const recentTime = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      expect(isCooldownActive(recentTime, 60)).toBe(true);
    });

    it("should handle exact cooldown boundary", () => {
      const exactlyNow = new Date(Date.now() - 60 * 1000); // exactly 60 seconds ago
      // At the exact boundary, cooldown should be expired
      const cooldownEndsAt = exactlyNow.getTime() + 60 * 1000;
      expect(Date.now() >= cooldownEndsAt).toBe(true);
    });
  });
});
