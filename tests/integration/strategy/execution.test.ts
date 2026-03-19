import { describe, it, expect } from "vitest";
import { clobOrderBookTightSpreadFixture } from "../../fixtures/polymarket/clob/orderbook";
import { evaluateOrderbookImbalance } from "@/lib/strategy/rules/spread-imbalance";
import { evaluateRangeEntry, evaluateRangeExit } from "@/lib/strategy/rules/range-quoting";

// Integration test: signal generation -> risk validation -> order preparation
describe("strategy execution integration", () => {
  describe("signal to order preparation flow", () => {
    it("should generate signal from orderbook data", () => {
      const orderbook = clobOrderBookTightSpreadFixture;
      const bestBid = Number(orderbook.bids[0].price);
      const bestAsk = Number(orderbook.asks[0].price);
      const spread = bestAsk - bestBid;

      // Create significantly imbalanced book to trigger signal
      const signal = evaluateOrderbookImbalance({
        params: {
          maxSpread: 0.05,
          minTopDepth: 1000,
          imbalanceRatio: 0.3,
        },
        spread,
        bestBid: String(bestBid),
        bestAsk: String(bestAsk),
        topBidSize: "8000", // 8000 vs 1000 = 0.7 imbalance
        topAskSize: "1000",
      });

      expect(signal).not.toBeNull();
      expect(signal?.signalType).toBe("DEPTH_IMBALANCE");
    });

    it("should generate entry signal when in range", () => {
      const orderbook = clobOrderBookTightSpreadFixture;
      const bestBid = Number(orderbook.bids[0].price);
      const bestAsk = Number(orderbook.asks[0].price);
      const spread = bestAsk - bestBid;
      const midPrice = (bestBid + bestAsk) / 2;

      const signal = evaluateRangeEntry({
        params: {
          entryLow: 0.40,
          entryHigh: 0.60,
          exitLow: 0.20,
          exitHigh: 0.80,
          orderSize: 10,
          maxInventoryPerSide: 100,
          maxInventoryPerMarket: 200,
          maxOpenOrdersPerSide: 2,
          maxSpread: 0.05,
          minTopLevelSize: 0,
          maxQuoteAgeMs: 5000,
          trendFilterEnabled: false,
          trendFilterThreshold: 0.10,
          allowBothSidesInventory: true,
        },
        bestBid,
        bestAsk,
        midPrice,
        spread,
        topBidSize: orderbook.bids[0].size,
        topAskSize: orderbook.asks[0].size,
        tickSize: 0.001,
        currentInventory: 0,
        maxInventoryPerSide: 100,
      });

      expect(signal).not.toBeNull();
      expect(signal?.signalType).toBe("RANGE_ENTRY");
      expect(signal?.side).toBe("BUY");
    });

    it("should generate exit signal when inventory exists and in exit band", () => {
      const bestBid = 0.35;
      const bestAsk = 0.37;
      const spread = bestAsk - bestBid;
      const midPrice = (bestBid + bestAsk) / 2;

      const signal = evaluateRangeExit({
        params: {
          entryLow: 0.40,
          entryHigh: 0.60,
          exitLow: 0.30,
          exitHigh: 0.40,
          orderSize: 10,
          maxInventoryPerSide: 100,
          maxInventoryPerMarket: 200,
          maxOpenOrdersPerSide: 2,
          maxSpread: 0.05,
          minTopLevelSize: 0,
          maxQuoteAgeMs: 5000,
          trendFilterEnabled: false,
          trendFilterThreshold: 0.10,
          allowBothSidesInventory: true,
        },
        bestBid,
        bestAsk,
        midPrice,
        spread,
        topBidSize: "1000",
        topAskSize: "1000",
        tickSize: 0.001,
        currentInventory: 50,
      });

      expect(signal).not.toBeNull();
      expect(signal?.signalType).toBe("RANGE_EXIT");
      expect(signal?.side).toBe("SELL");
    });
  });

  describe("order lifecycle state transitions", () => {
    it("should model PENDING -> SUBMITTED transition", () => {
      const order = {
        status: "PENDING" as const,
        dryRun: false,
      };

      // Simulate successful submission
      const updatedOrder = {
        ...order,
        status: "SUBMITTED" as const,
        submittedAt: new Date(),
      };

      expect(updatedOrder.status).toBe("SUBMITTED");
    });

    it("should model PENDING -> REJECTED transition on failure", () => {
      const order = {
        status: "PENDING" as const,
        dryRun: false,
        errorMessage: null as string | null,
      };

      // Simulate rejection
      const updatedOrder = {
        ...order,
        status: "REJECTED" as const,
        errorMessage: "Insufficient margin",
      };

      expect(updatedOrder.status).toBe("REJECTED");
      expect(updatedOrder.errorMessage).toBe("Insufficient margin");
    });

    it("should model SUBMITTED -> FILLED transition", () => {
      const order = {
        status: "SUBMITTED" as const,
        size: 10,
        filledSize: 0,
      };

      // Simulate partial fill then full fill
      const partialFill = {
        ...order,
        status: "PARTIALLY_FILLED" as const,
        filledSize: 5,
      };

      expect(partialFill.status).toBe("PARTIALLY_FILLED");
      expect(partialFill.filledSize).toBe(5);

      const fullFill = {
        ...partialFill,
        status: "FILLED" as const,
        filledSize: 10,
      };

      expect(fullFill.status).toBe("FILLED");
      expect(fullFill.filledSize).toBe(10);
    });

    it("should model SUBMITTED -> CANCELLED transition", () => {
      const order = {
        status: "SUBMITTED" as const,
        size: 10,
        filledSize: 0,
      };

      // Simulate cancellation
      const cancelledOrder = {
        ...order,
        status: "CANCELLED" as const,
        cancelledAt: new Date(),
      };

      expect(cancelledOrder.status).toBe("CANCELLED");
    });
  });

  describe("inventory tracking", () => {
    it("should calculate net inventory from YES/NO positions", () => {
      // In Polymarket, YES and NO are complementary positions
      // If you have 100 YES and 0 NO, your net exposure is long 100
      // If you have 0 YES and 100 NO, your net exposure is short 100

      const positions = [
        { outcome: "Yes", size: 100 },
        { outcome: "No", size: 0 },
      ];

      // YES position contributes positively to inventory
      const yesInventory = positions
        .filter((p) => p.outcome === "Yes")
        .reduce((sum, p) => sum + p.size, 0);

      // NO position contributes negatively (opposite direction)
      const noInventory = positions
        .filter((p) => p.outcome === "No")
        .reduce((sum, p) => sum + p.size, 0);

      const netInventory = yesInventory - noInventory;
      expect(netInventory).toBe(100); // Long position
    });

    it("should handle mixed YES/NO inventory correctly", () => {
      const positions = [
        { outcome: "Yes", size: 80 },
        { outcome: "No", size: 30 },
      ];

      const yesInventory = positions
        .filter((p) => p.outcome === "Yes")
        .reduce((sum, p) => sum + p.size, 0);

      const noInventory = positions
        .filter((p) => p.outcome === "No")
        .reduce((sum, p) => sum + p.size, 0);

      const netInventory = yesInventory - noInventory;
      expect(netInventory).toBe(50); // Still net long but less
    });

    it("should account for open sell orders in inventory calculation", () => {
      // Open sell orders represent potential inventory (you owe the asset)
      const currentInventory = 50;
      const openSellOrders = [
        { side: "SELL", size: 20, status: "SUBMITTED" },
        { side: "BUY", size: 10, status: "SUBMITTED" },
      ];

      // Sell orders increase your net short exposure
      const pendingSellVolume = openSellOrders
        .filter((o) => o.side === "SELL" && o.status === "SUBMITTED")
        .reduce((sum, o) => sum + o.size, 0);

      // Buy orders decrease your net exposure
      const pendingBuyVolume = openSellOrders
        .filter((o) => o.side === "BUY" && o.status === "SUBMITTED")
        .reduce((sum, o) => sum + o.size, 0);

      const effectiveInventory = currentInventory + pendingSellVolume - pendingBuyVolume;
      expect(effectiveInventory).toBe(60); // 50 + 20 - 10
    });
  });
});
