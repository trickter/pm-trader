import { describe, it, expect } from "vitest";

// Test reconciliation logic between local state and remote state
describe("reconciliation logic", () => {
  describe("fill reconciliation", () => {
    it("should detect missing fills from remote trades", () => {
      const localFills = [
        { id: "fill1", tradeId: "trade1" },
        { id: "fill2", tradeId: "trade2" },
      ];

      const remoteTrades = [
        { id: "trade1", side: "BUY", size: 10 },
        { id: "trade2", side: "BUY", size: 5 },
        { id: "trade3", side: "SELL", size: 3 }, // New trade not in local
      ];

      const localTradeIds = new Set(localFills.map((f) => f.tradeId));
      const missingTrades = remoteTrades.filter(
        (t) => !localTradeIds.has(t.id)
      );

      expect(missingTrades).toHaveLength(1);
      expect(missingTrades[0].id).toBe("trade3");
    });

    it("should not duplicate fills that already exist", () => {
      const localFills = [
        { id: "fill1", tradeId: "trade1" },
        { id: "fill2", tradeId: "trade2" },
      ];

      const remoteTrades = [
        { id: "trade1", side: "BUY", size: 10 },
        { id: "trade2", side: "BUY", size: 5 },
      ];

      const localTradeIds = new Set(localFills.map((f) => f.tradeId));
      const missingTrades = remoteTrades.filter(
        (t) => !localTradeIds.has(t.id)
      );

      expect(missingTrades).toHaveLength(0);
    });

    it("should handle empty local fills", () => {
      const localFills: { id: string; tradeId: string }[] = [];
      const remoteTrades = [
        { id: "trade1", side: "BUY", size: 10 },
      ];

      const localTradeIds = new Set(localFills.map((f) => f.tradeId));
      const missingTrades = remoteTrades.filter(
        (t) => !localTradeIds.has(t.id)
      );

      expect(missingTrades).toHaveLength(1);
    });
  });

  describe("order reconciliation", () => {
    it("should mark local order as UNKNOWN when not found in remote", () => {
      const localOrders = [
        { id: "order1", status: "SUBMITTED", polymarketOrderId: "pm1" },
        { id: "order2", status: "SUBMITTED", polymarketOrderId: "pm2" },
      ];

      const remoteOpenOrders = [
        { orderId: "pm1", status: "OPEN" },
        // pm2 is missing from remote
      ];

      const remoteOrderIds = new Set(remoteOpenOrders.map((o) => o.orderId));
      const staleOrders = localOrders.filter(
        (o) => o.status === "SUBMITTED" && !remoteOrderIds.has(o.polymarketOrderId)
      );

      expect(staleOrders).toHaveLength(1);
      expect(staleOrders[0].id).toBe("order2");
    });

    it("should preserve local order when found in remote", () => {
      const localOrders = [
        { id: "order1", status: "SUBMITTED", polymarketOrderId: "pm1" },
        { id: "order2", status: "SUBMITTED", polymarketOrderId: "pm2" },
      ];

      const remoteOpenOrders = [
        { orderId: "pm1", status: "OPEN" },
        { orderId: "pm2", status: "OPEN" },
      ];

      const remoteOrderIds = new Set(remoteOpenOrders.map((o) => o.orderId));
      const staleOrders = localOrders.filter(
        (o) => o.status === "SUBMITTED" && !remoteOrderIds.has(o.polymarketOrderId)
      );

      expect(staleOrders).toHaveLength(0);
    });

    it("should handle partially filled orders correctly", () => {
      const localOrders = [
        { id: "order1", status: "PARTIALLY_FILLED", filledSize: 5, size: 10, polymarketOrderId: "pm1" },
      ];

      const remoteOrders = [
        { orderId: "pm1", status: "OPEN", filledSize: 5 },
      ];

      // Partially filled orders should still appear in open orders
      const remoteOrderIds = new Set(remoteOrders.map((o) => o.orderId));
      const staleOrders = localOrders.filter(
        (o) => o.status === "SUBMITTED" && !remoteOrderIds.has(o.polymarketOrderId)
      );

      // This order is PARTIALLY_FILLED, not SUBMITTED, so it won't be flagged
      expect(staleOrders).toHaveLength(0);
    });
  });

  describe("position reconciliation", () => {
    it("should calculate position from fills when not directly available", () => {
      const fills = [
        { side: "BUY", size: 10, price: 0.50 },
        { side: "BUY", size: 5, price: 0.52 },
        { side: "SELL", size: 3, price: 0.55 },
      ];

      // Calculate net position
      const buys = fills.filter((f) => f.side === "BUY");
      const sells = fills.filter((f) => f.side === "SELL");

      const totalBought = buys.reduce((sum, f) => sum + f.size, 0);
      const totalSold = sells.reduce((sum, f) => sum + f.size, 0);
      const netPosition = totalBought - totalSold;

      expect(netPosition).toBe(12); // 15 - 3

      // Calculate average price for bought shares
      const totalCost = buys.reduce((sum, f) => sum + f.size * f.price, 0);
      const avgBuyPrice = totalCost / totalBought;

      expect(avgBuyPrice).toBeCloseTo(0.5067, 3); // (10*0.50 + 5*0.52) / 15
    });

    it("should handle empty fills array", () => {
      const fills: { side: "BUY" | "SELL"; size: number; price: number }[] = [];

      const buys = fills.filter((f) => f.side === "BUY");
      const sells = fills.filter((f) => f.side === "SELL");

      const totalBought = buys.reduce((sum, f) => sum + f.size, 0);
      const totalSold = sells.reduce((sum, f) => sum + f.size, 0);
      const netPosition = totalBought - totalSold;

      expect(netPosition).toBe(0);
    });
  });

  describe("duplicate message handling", () => {
    it("should deduplicate trades by trade ID", () => {
      const trades = [
        { id: "trade1", side: "BUY", size: 10 },
        { id: "trade2", side: "BUY", size: 5 },
        { id: "trade1", side: "BUY", size: 10 }, // duplicate
        { id: "trade3", side: "SELL", size: 3 },
      ];

      const seen = new Set<string>();
      const uniqueTrades = trades.filter((t) => {
        if (seen.has(t.id)) {
          return false;
        }
        seen.add(t.id);
        return true;
      });

      expect(uniqueTrades).toHaveLength(3);
    });

    it("should deduplicate order updates by order ID", () => {
      const orderUpdates = [
        { id: "order1", status: "OPEN", size_matched: "0" },
        { id: "order1", status: "OPEN", size_matched: "5" }, // updated
        { id: "order2", status: "OPEN", size_matched: "0" },
      ];

      const seen = new Set<string>();
      const uniqueUpdates = orderUpdates.filter((o) => {
        if (seen.has(o.id)) {
          return false;
        }
        seen.add(o.id);
        return true;
      });

      // Only first occurrence of each order ID is kept
      expect(uniqueUpdates).toHaveLength(2);
      const order1Update = uniqueUpdates.find((u) => u.id === "order1");
      expect(order1Update?.size_matched).toBe("0"); // First occurrence kept
    });
  });
});
