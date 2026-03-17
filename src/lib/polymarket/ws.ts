import "server-only";

import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getRuntimeSettings } from "@/lib/db/settings";
import { logger } from "@/lib/logger";
import { getMarketQuote } from "@/lib/polymarket/clob-public";
import { getOrCreateApiCredentials, listOpenOrders, listTrades } from "@/lib/polymarket/clob-trading";
import { getPositions } from "@/lib/polymarket/data";
import { getMarketById } from "@/lib/polymarket/gamma";
import {
  clobOrderBookSchema,
  marketWsMessageSchema,
  type MarketWsMessage,
  userWsMessageSchema,
} from "@/lib/polymarket/types";
import { getStaticTarget } from "@/lib/strategy/config";
import {
  defaultTradingHealthSnapshot,
  type TradingHealthSnapshot,
  persistTradingHealth,
} from "@/lib/trading/health";
import { parseJsonArray, toInputJson } from "@/lib/utils";

const MARKET_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const USER_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/user";
const MONITOR_INTERVAL_MS = 1000;
const TARGET_REFRESH_INTERVAL_MS = 15000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 10000;

type LiveMarketSnapshot = {
  tokenId: string;
  marketId: string;
  conditionId?: string | null;
  book?: {
    market: string;
    asset_id: string;
    timestamp: string;
    hash: string;
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
    min_order_size: string;
    tick_size: string;
    neg_risk: boolean;
    last_trade_price: string;
  };
  bestBid?: string;
  bestAsk?: string;
  spread?: string;
  midpoint?: string;
  lastTradePrice?: string;
  tickSize?: string;
  negRisk?: boolean;
  lifecycleEvent?: string;
  lastUpdatedAt: Date;
  source: "ws" | "http";
};

type LiveUserOrderState = {
  orderId: string;
  marketId: string;
  assetId: string;
  status?: string;
  side?: string;
  price?: string;
  originalSize?: string;
  sizeMatched?: string;
  lastUpdatedAt: Date;
};

type LiveUserTradeState = {
  tradeId: string;
  marketId: string;
  assetId: string;
  status?: string;
  price: string;
  size: string;
  side?: string;
  takerOrderId?: string;
  makerOrderIds: string[];
  lastUpdatedAt: Date;
};

type ReconcileReason = "startup" | "reconnect" | "manual";

function compareStringSets(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) {
    return false;
  }

  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }

  return true;
}

function bestBidFromBook(book?: LiveMarketSnapshot["book"]) {
  return book?.bids?.[0]?.price;
}

function bestAskFromBook(book?: LiveMarketSnapshot["book"]) {
  return book?.asks?.[0]?.price;
}

function computeSpread(bestBid?: string, bestAsk?: string) {
  if (bestBid === undefined || bestAsk === undefined) {
    return undefined;
  }

  const spread = Number(bestAsk) - Number(bestBid);
  return Number.isFinite(spread) ? spread.toString() : undefined;
}

function computeMidpoint(bestBid?: string, bestAsk?: string) {
  if (bestBid === undefined || bestAsk === undefined) {
    return undefined;
  }

  const midpoint = (Number(bestBid) + Number(bestAsk)) / 2;
  return Number.isFinite(midpoint) ? midpoint.toString() : undefined;
}

function updateBookSide(
  levels: Array<{ price: string; size: string }>,
  update: { price: string; size: string },
  descending: boolean,
) {
  const filtered = levels.filter((level) => level.price !== update.price);
  if (Number(update.size) > 0) {
    filtered.push({ price: update.price, size: update.size });
  }

  filtered.sort((left, right) =>
    descending ? Number(right.price) - Number(left.price) : Number(left.price) - Number(right.price),
  );

  return filtered;
}

function normalizeBookSnapshot(snapshot: LiveMarketSnapshot) {
  const book = snapshot.book;
  const bestBid = snapshot.bestBid ?? bestBidFromBook(book);
  const bestAsk = snapshot.bestAsk ?? bestAskFromBook(book);

  return {
    ...snapshot,
    bestBid,
    bestAsk,
    spread: snapshot.spread ?? computeSpread(bestBid, bestAsk),
    midpoint: snapshot.midpoint ?? computeMidpoint(bestBid, bestAsk),
    tickSize: snapshot.tickSize ?? book?.tick_size,
    negRisk: snapshot.negRisk ?? book?.neg_risk,
    lastTradePrice: snapshot.lastTradePrice ?? book?.last_trade_price,
  };
}

async function updateLocalOrderStatus(orderId: string, data: Partial<{
  status: OrderStatus;
  errorMessage: string | null;
  rawResponse: Record<string, unknown>;
  polymarketOrderId: string | null;
}>) {
  const updateData: Record<string, unknown> = {};

  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.errorMessage !== undefined) {
    updateData.errorMessage = data.errorMessage;
  }
  if (data.rawResponse !== undefined) {
    updateData.rawResponse = toInputJson(data.rawResponse);
  }
  if (data.polymarketOrderId !== undefined) {
    updateData.polymarketOrderId = data.polymarketOrderId;
  }

  await db.order.updateMany({
    where: {
      OR: [
        { polymarketOrderId: orderId },
        { clientOrderId: orderId },
      ],
    },
    data: updateData,
  });
}

class PolymarketStreamSupervisor {
  private marketSocket: WebSocket | null = null;
  private userSocket: WebSocket | null = null;
  private marketReconnectAttempt = 0;
  private userReconnectAttempt = 0;
  private targetRefreshTimer: NodeJS.Timeout | null = null;
  private monitorTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private runtimeSettings = { fetchedAt: 0, value: null as Awaited<ReturnType<typeof getRuntimeSettings>> | null };
  private reconcilePromise: Promise<void> | null = null;
  private started = false;
  private flushing = false;
  private trackedTokenIds = new Set<string>();
  private trackedConditionIds = new Set<string>();
  private marketSnapshots = new Map<string, LiveMarketSnapshot>();
  private liveOrders = new Map<string, LiveUserOrderState>();
  private liveTrades = new Map<string, LiveUserTradeState>();
  private health: TradingHealthSnapshot = {
    ...defaultTradingHealthSnapshot,
    details: {
      trackedTokenCount: 0,
      trackedConditionCount: 0,
    },
  };

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.targetRefreshTimer = setInterval(() => {
      this.refreshTrackedTargets().catch((error) => {
        logger.error("ws: failed to refresh tracked targets", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, TARGET_REFRESH_INTERVAL_MS);

    this.monitorTimer = setInterval(() => {
      this.monitorFreshness().catch((error) => {
        logger.error("ws: freshness monitor failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, MONITOR_INTERVAL_MS);

    void this.refreshTrackedTargets()
      .then(() => this.reconcile("startup"))
      .catch((error) => {
        logger.error("ws: startup reconcile failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  async getHealth() {
    return this.health;
  }

  getMarketSnapshot(tokenId: string) {
    return this.marketSnapshots.get(tokenId) ?? null;
  }

  getUserStateSnapshot() {
    return {
      orders: Array.from(this.liveOrders.values()),
      trades: Array.from(this.liveTrades.values()),
      lastUserMessageAt: this.health.lastUserMessageAt,
      lastUserReconciledAt: this.health.lastUserReconciledAt,
    };
  }

  async ensureTargetsTracked(input: Array<{ marketId?: string; tokenId?: string; conditionId?: string }>) {
    const nextTokens = new Set(this.trackedTokenIds);
    const nextConditions = new Set(this.trackedConditionIds);
    const marketCache = new Map<string, Awaited<ReturnType<typeof getMarketById>>>();

    for (const target of input) {
      if (target.tokenId) {
        nextTokens.add(target.tokenId);
      }
      if (target.conditionId) {
        nextConditions.add(target.conditionId);
      }
      if (target.marketId && !marketCache.has(target.marketId)) {
        marketCache.set(target.marketId, await getMarketById(target.marketId));
      }
      const market = target.marketId ? marketCache.get(target.marketId) : null;
      if (market?.conditionId) {
        nextConditions.add(market.conditionId);
      }
      for (const tokenId of parseJsonArray(market?.clobTokenIds)) {
        nextTokens.add(tokenId);
      }
    }

    await this.replaceTrackedTargets(nextTokens, nextConditions);
    await this.reconcile("manual");
  }

  async reconcile(reason: ReconcileReason) {
    if (this.reconcilePromise) {
      await this.reconcilePromise;
      return;
    }

    this.reconcilePromise = this.runReconcile(reason).finally(() => {
      this.reconcilePromise = null;
    });
    await this.reconcilePromise;
  }

  private async getRuntime() {
    if (!this.runtimeSettings.value || Date.now() - this.runtimeSettings.fetchedAt > 5000) {
      this.runtimeSettings = {
        fetchedAt: Date.now(),
        value: await getRuntimeSettings(),
      };
    }

    return this.runtimeSettings.value!;
  }

  private async runReconcile(reason: ReconcileReason) {
    const previousFailures = Number(this.health.details.reconcileFailureCount ?? 0);
    const reconcileAttempt = Number(this.health.details.reconcileAttempt ?? 0) + 1;

    await this.patchHealth({
      reconciling: true,
      tradingBlocked: true,
      blockReason: `reconcile_required:${reason}`,
      lastHeartbeatAt: new Date(),
      details: {
        ...this.health.details,
        reconcileReason: reason,
        reconcileAttempt,
      },
    });

    try {
      const trackedTokenIds = Array.from(this.trackedTokenIds);
      const [quotes, openOrders, trades, positions] = await Promise.all([
        Promise.all(
          trackedTokenIds.map(async (tokenId) => ({
            tokenId,
            quote: await getMarketQuote(tokenId),
          })),
        ),
        listOpenOrders().catch(() => []),
        listTrades().catch(() => []),
        getPositions(process.env.POLYMARKET_TRADER_ADDRESS || undefined).catch(() => []),
      ]);

      const now = new Date();

      for (const { tokenId, quote } of quotes) {
        const snapshot = normalizeBookSnapshot({
          tokenId,
          marketId: quote.book.market,
          book: clobOrderBookSchema.parse({
            ...quote.book,
            timestamp: quote.book.timestamp ?? String(Date.now()),
            hash: quote.book.hash ?? "",
          }),
          bestBid: String(quote.bestBid),
          bestAsk: String(quote.bestAsk),
          spread: String(quote.spread),
          midpoint: String(quote.midpoint),
          lastTradePrice: String(quote.lastTradePrice),
          tickSize: quote.book.tick_size,
          negRisk: quote.book.neg_risk,
          lastUpdatedAt: now,
          source: "http",
        });
        this.marketSnapshots.set(tokenId, snapshot);
      }

      const openOrderIds = new Set<string>();
      for (const order of openOrders) {
        openOrderIds.add(order.id);
        const status =
          Number(order.size_matched ?? 0) > 0 ? OrderStatus.PARTIALLY_FILLED : OrderStatus.SUBMITTED;
        this.liveOrders.set(order.id, {
          orderId: order.id,
          marketId: order.market,
          assetId: order.asset_id,
          status: order.status,
          side: order.side,
          price: order.price,
          originalSize: order.original_size,
          sizeMatched: order.size_matched,
          lastUpdatedAt: now,
        });
        await updateLocalOrderStatus(order.id, {
          polymarketOrderId: order.id,
          status,
          rawResponse: toInputJson(order),
          errorMessage: null,
        });
      }

      const seenTradeIds = new Set<string>();
      for (const trade of trades) {
        seenTradeIds.add(trade.id);
        const makerOrderIds = trade.maker_orders.map((maker) => maker.order_id);
        this.liveTrades.set(trade.id, {
          tradeId: trade.id,
          marketId: trade.market,
          assetId: trade.asset_id,
          status: trade.status,
          price: trade.price,
          size: trade.size,
          side: trade.side,
          takerOrderId: trade.taker_order_id,
          makerOrderIds,
          lastUpdatedAt: now,
        });

        await db.fill.upsert({
          where: { polymarketTradeId: trade.id },
          create: {
            polymarketTradeId: trade.id,
            marketId: trade.market,
            tokenId: trade.asset_id,
            side: trade.side === "BUY" ? "BUY" : "SELL",
            price: Number(trade.price),
            size: Number(trade.size),
            source: "CLOB",
            raw: toInputJson(trade),
          },
          update: {
            raw: toInputJson(trade),
            price: Number(trade.price),
            size: Number(trade.size),
            source: "CLOB",
          },
        });

        await updateLocalOrderStatus(trade.taker_order_id, {
          status: OrderStatus.FILLED,
        });

        for (const makerOrderId of makerOrderIds) {
          await updateLocalOrderStatus(makerOrderId, {
            status: OrderStatus.PARTIALLY_FILLED,
          });
        }
      }

      const localOrders = await db.order.findMany({
        where: {
          dryRun: false,
          status: { in: [OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED] },
          polymarketOrderId: { not: null },
        },
      });

      for (const localOrder of localOrders) {
        if (!localOrder.polymarketOrderId) {
          continue;
        }

        if (openOrderIds.has(localOrder.polymarketOrderId)) {
          continue;
        }

        const matchedTrade = Array.from(this.liveTrades.values()).find(
          (trade) =>
            trade.takerOrderId === localOrder.polymarketOrderId ||
            (localOrder.polymarketOrderId ? trade.makerOrderIds.includes(localOrder.polymarketOrderId) : false),
        );

        if (matchedTrade) {
          await db.order.update({
            where: { id: localOrder.id },
            data: {
              status:
                Number(matchedTrade.size) >= Number(localOrder.size)
                  ? OrderStatus.FILLED
                  : OrderStatus.PARTIALLY_FILLED,
            },
          });
        } else {
          await db.order.update({
            where: { id: localOrder.id },
            data: {
              status: OrderStatus.UNKNOWN,
            },
          });
        }
      }

      await this.patchHealth({
        reconciling: false,
        lastMarketReconciledAt: trackedTokenIds.length > 0 ? now : this.health.lastMarketReconciledAt,
        lastUserReconciledAt: now,
        lastHeartbeatAt: now,
        details: {
          ...this.health.details,
          lastReconcileReason: reason,
          lastReconcileStatus: "success",
          lastReconcileError: null,
          openOrders: openOrders.length,
          trades: seenTradeIds.size,
          positions: positions.length,
          reconcileFailureCount: 0,
        },
      });

      await this.monitorFreshness();
    } catch (error) {
      logger.error("ws: reconcile failed", {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.patchHealth({
        reconciling: false,
        tradingBlocked: true,
        blockReason: `reconcile_failed:${reason}`,
        lastHeartbeatAt: new Date(),
        details: {
          ...this.health.details,
          lastReconcileStatus: "failed",
          lastReconcileError: error instanceof Error ? error.message : String(error),
          reconcileFailureCount: previousFailures + 1,
        },
      });
    }
  }

  private async refreshTrackedTargets() {
    const [strategies, liveOrders] = await Promise.all([
      db.strategy.findMany({
        where: { enabled: true },
        select: { marketId: true, tokenId: true, type: true, scopeType: true, scopeParams: true },
      }),
      db.order.findMany({
        where: {
          dryRun: false,
          status: { in: [OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED] },
        },
        select: { marketId: true, tokenId: true },
      }),
    ]);

    const nextTokenIds = new Set<string>();
    const nextConditionIds = new Set<string>();
    const marketIds = new Set<string>();

    for (const strategy of strategies) {
      const target = getStaticTarget(strategy);
      if (!target) {
        continue;
      }
      marketIds.add(target.marketId);
      if (target.tokenId && target.tokenId !== "auto") {
        nextTokenIds.add(target.tokenId);
      }
    }

    for (const order of liveOrders) {
      marketIds.add(order.marketId);
      nextTokenIds.add(order.tokenId);
    }

    const resolvedMarkets = await Promise.all(Array.from(marketIds).map((marketId) => getMarketById(marketId)));
    for (const market of resolvedMarkets) {
      if (market.conditionId) {
        nextConditionIds.add(market.conditionId);
      }
      for (const tokenId of parseJsonArray(market.clobTokenIds)) {
        nextTokenIds.add(tokenId);
      }
    }

    await this.replaceTrackedTargets(nextTokenIds, nextConditionIds);
  }

  private async replaceTrackedTargets(nextTokenIds: Set<string>, nextConditionIds: Set<string>) {
    const tokensChanged = !compareStringSets(this.trackedTokenIds, nextTokenIds);
    const conditionsChanged = !compareStringSets(this.trackedConditionIds, nextConditionIds);

    if (!tokensChanged && !conditionsChanged) {
      return;
    }

    this.trackedTokenIds = nextTokenIds;
    this.trackedConditionIds = nextConditionIds;

    await this.patchHealth({
      lastHeartbeatAt: new Date(),
      details: {
        ...this.health.details,
        trackedTokenCount: nextTokenIds.size,
        trackedConditionCount: nextConditionIds.size,
      },
    });

    if (nextTokenIds.size > 0 && (!this.marketSocket || this.marketSocket.readyState > WebSocket.OPEN)) {
      this.connectMarketSocket();
    } else if (tokensChanged && this.marketSocket?.readyState === WebSocket.OPEN) {
      this.sendMarketSubscription();
    }

    if (nextConditionIds.size > 0 && (!this.userSocket || this.userSocket.readyState > WebSocket.OPEN)) {
      this.connectUserSocket();
    } else if (conditionsChanged && this.userSocket?.readyState === WebSocket.OPEN) {
      void this.sendUserSubscription();
    }
  }

  private schedulePersist() {
    if (this.flushTimer || this.flushing) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushing = true;
      persistTradingHealth(this.health)
        .catch((error) => {
          logger.error("ws: failed to persist trading health", {
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          this.flushing = false;
        });
    }, 250);
  }

  private async patchHealth(patch: Partial<TradingHealthSnapshot>) {
    this.health = {
      ...this.health,
      ...patch,
      details: {
        ...this.health.details,
        ...(patch.details ?? {}),
      },
    };
    this.schedulePersist();
  }

  private connectMarketSocket() {
    if (this.marketSocket && this.marketSocket.readyState <= WebSocket.OPEN) {
      return;
    }

    if (this.trackedTokenIds.size === 0) {
      void this.patchHealth({
        marketWsConnected: false,
        marketStale: false,
        tradingBlocked: this.health.reconciling || this.health.userStale,
        blockReason: this.health.userStale ? "stale_user_data" : this.health.blockReason,
      });
      return;
    }

    this.marketSocket = new WebSocket(MARKET_WS_URL);
    this.marketSocket.addEventListener("open", () => {
      this.marketReconnectAttempt = 0;
      void this.patchHealth({
        marketWsConnected: true,
        tradingBlocked: true,
        blockReason: "reconcile_required:reconnect",
        lastHeartbeatAt: new Date(),
      });
      this.sendMarketSubscription();
      void this.reconcile("reconnect");
    });

    this.marketSocket.addEventListener("message", (event) => {
      void this.handleMarketMessage(String(event.data));
    });

    this.marketSocket.addEventListener("close", () => {
      void this.patchHealth({
        marketWsConnected: false,
        tradingBlocked: this.trackedTokenIds.size > 0 || this.health.userStale,
        blockReason: this.trackedTokenIds.size > 0 ? "market_ws_disconnected" : this.health.blockReason,
        lastHeartbeatAt: new Date(),
      });
      this.scheduleMarketReconnect();
    });

    this.marketSocket.addEventListener("error", () => {
      this.marketSocket?.close();
    });
  }

  private connectUserSocket() {
    if (this.userSocket && this.userSocket.readyState <= WebSocket.OPEN) {
      return;
    }

    if (this.trackedConditionIds.size === 0) {
      void this.patchHealth({
        userWsConnected: false,
        userStale: false,
        tradingBlocked: this.health.reconciling || this.health.marketStale,
        blockReason: this.health.marketStale ? "stale_market_data" : this.health.blockReason,
      });
      return;
    }

    this.userSocket = new WebSocket(USER_WS_URL);
    this.userSocket.addEventListener("open", () => {
      this.userReconnectAttempt = 0;
      void this.patchHealth({
        userWsConnected: true,
        tradingBlocked: true,
        blockReason: "reconcile_required:reconnect",
        lastHeartbeatAt: new Date(),
      });
      void this.sendUserSubscription();
      void this.reconcile("reconnect");
    });

    this.userSocket.addEventListener("message", (event) => {
      void this.handleUserMessage(String(event.data));
    });

    this.userSocket.addEventListener("close", () => {
      void this.patchHealth({
        userWsConnected: false,
        tradingBlocked: this.trackedConditionIds.size > 0 || this.health.marketStale,
        blockReason: this.trackedConditionIds.size > 0 ? "user_ws_disconnected" : this.health.blockReason,
        lastHeartbeatAt: new Date(),
      });
      this.scheduleUserReconnect();
    });

    this.userSocket.addEventListener("error", () => {
      this.userSocket?.close();
    });
  }

  private sendMarketSubscription() {
    if (!this.marketSocket || this.marketSocket.readyState !== WebSocket.OPEN || this.trackedTokenIds.size === 0) {
      return;
    }

    this.marketSocket.send(
      JSON.stringify({
        assets: Array.from(this.trackedTokenIds),
        type: "market",
        custom_feature_enabled: true,
      }),
    );
  }

  private async sendUserSubscription() {
    if (!this.userSocket || this.userSocket.readyState !== WebSocket.OPEN || this.trackedConditionIds.size === 0) {
      return;
    }

    const creds = await getOrCreateApiCredentials();
    this.userSocket.send(
      JSON.stringify({
        auth: {
          apiKey: creds.key,
          secret: creds.secret,
          passphrase: creds.passphrase,
        },
        markets: Array.from(this.trackedConditionIds),
        type: "user",
      }),
    );
  }

  private scheduleMarketReconnect() {
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** this.marketReconnectAttempt, RECONNECT_MAX_DELAY_MS);
    this.marketReconnectAttempt += 1;
    setTimeout(() => this.connectMarketSocket(), delay);
  }

  private scheduleUserReconnect() {
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** this.userReconnectAttempt, RECONNECT_MAX_DELAY_MS);
    this.userReconnectAttempt += 1;
    setTimeout(() => this.connectUserSocket(), delay);
  }

  private async handleMarketMessage(raw: string) {
    const payload = JSON.parse(raw) as unknown;
    const messages = Array.isArray(payload) ? payload : [payload];

    for (const item of messages) {
      const parsed = marketWsMessageSchema.safeParse(item);
      if (!parsed.success) {
        continue;
      }

      const message = parsed.data;
      const receivedAt = new Date();
      await this.patchHealth({
        lastMarketMessageAt: receivedAt,
        lastHeartbeatAt: receivedAt,
      });

      await this.applyMarketMessage(message, receivedAt);
    }

    await this.monitorFreshness();
  }

  private async applyMarketMessage(message: MarketWsMessage, receivedAt: Date) {
    if (message.event_type === "market_resolved") {
      await this.patchHealth({
        details: {
          ...this.health.details,
          lastMarketLifecycleEvent: message.event_type,
        },
      });
      return;
    }

    const existing = this.marketSnapshots.get(message.asset_id);
    const baseSnapshot: LiveMarketSnapshot =
      existing ?? {
        tokenId: message.asset_id,
        marketId: message.market,
        lastUpdatedAt: receivedAt,
        source: "ws",
      };

    if (message.event_type === "book") {
      const snapshot = normalizeBookSnapshot({
        ...baseSnapshot,
        marketId: message.market,
        book: {
          market: message.market,
          asset_id: message.asset_id,
          timestamp: message.timestamp ?? String(receivedAt.getTime()),
          hash: message.hash ?? "",
          bids: message.bids,
          asks: message.asks,
          min_order_size: message.min_order_size ?? existing?.book?.min_order_size ?? "0",
          tick_size: message.tick_size ?? existing?.tickSize ?? existing?.book?.tick_size ?? "0.01",
          neg_risk: message.neg_risk ?? existing?.negRisk ?? false,
          last_trade_price: message.last_trade_price ?? existing?.lastTradePrice ?? "0",
        },
        lastUpdatedAt: receivedAt,
        source: "ws",
      });
      this.marketSnapshots.set(message.asset_id, snapshot);
      return;
    }

    if (message.event_type === "price_change") {
      const book = baseSnapshot.book ?? {
        market: message.market,
        asset_id: message.asset_id,
        timestamp: String(receivedAt.getTime()),
        hash: "",
        bids: [],
        asks: [],
        min_order_size: "0",
        tick_size: baseSnapshot.tickSize ?? "0.01",
        neg_risk: baseSnapshot.negRisk ?? false,
        last_trade_price: baseSnapshot.lastTradePrice ?? "0",
      };

      for (const change of message.changes) {
        if (change.side === "BUY") {
          book.bids = updateBookSide(book.bids, { price: change.price, size: change.size }, true);
        } else {
          book.asks = updateBookSide(book.asks, { price: change.price, size: change.size }, false);
        }

        if (change.best_bid) {
          baseSnapshot.bestBid = change.best_bid;
        }
        if (change.best_ask) {
          baseSnapshot.bestAsk = change.best_ask;
        }
      }

      const snapshot = normalizeBookSnapshot({
        ...baseSnapshot,
        book,
        lastUpdatedAt: receivedAt,
        source: "ws",
      });
      this.marketSnapshots.set(message.asset_id, snapshot);
      return;
    }

    if (message.event_type === "best_bid_ask") {
      this.marketSnapshots.set(
        message.asset_id,
        normalizeBookSnapshot({
          ...baseSnapshot,
          bestBid: message.best_bid,
          bestAsk: message.best_ask,
          spread: message.spread,
          lastUpdatedAt: receivedAt,
          source: "ws",
        }),
      );
      return;
    }

    if (message.event_type === "last_trade_price") {
      this.marketSnapshots.set(
        message.asset_id,
        normalizeBookSnapshot({
          ...baseSnapshot,
          lastTradePrice: message.price,
          lastUpdatedAt: receivedAt,
          source: "ws",
        }),
      );
      return;
    }

    if (message.event_type === "tick_size_change") {
      this.marketSnapshots.set(
        message.asset_id,
        normalizeBookSnapshot({
          ...baseSnapshot,
          tickSize: message.new_tick_size,
          lastUpdatedAt: receivedAt,
          source: "ws",
        }),
      );
    }
  }

  private async handleUserMessage(raw: string) {
    const payload = JSON.parse(raw) as unknown;
    const messages = Array.isArray(payload) ? payload : [payload];

    for (const item of messages) {
      const parsed = userWsMessageSchema.safeParse(item);
      if (!parsed.success) {
        continue;
      }

      const message = parsed.data;
      const receivedAt = new Date();
      await this.patchHealth({
        lastUserMessageAt: receivedAt,
        lastHeartbeatAt: receivedAt,
      });

      if (message.event_type === "order") {
        this.liveOrders.set(message.id, {
          orderId: message.id,
          marketId: message.market,
          assetId: message.asset_id,
          status: message.status,
          side: message.side,
          price: message.price,
          originalSize: message.original_size,
          sizeMatched: message.size_matched,
          lastUpdatedAt: receivedAt,
        });

        const nextStatus = this.mapOrderStatus(message.status, message.size_matched, message.original_size);
        await updateLocalOrderStatus(message.id, {
          polymarketOrderId: message.id,
          status: nextStatus,
          rawResponse: toInputJson(message),
          errorMessage: nextStatus === OrderStatus.REJECTED ? message.status ?? "Rejected" : null,
        });
      } else {
        const makerOrderIds = message.maker_orders?.map((maker) => maker.order_id) ?? [];
        this.liveTrades.set(message.id, {
          tradeId: message.id,
          marketId: message.market,
          assetId: message.asset_id,
          status: message.status,
          price: message.price,
          size: message.size,
          side: message.side,
          takerOrderId: message.taker_order_id,
          makerOrderIds,
          lastUpdatedAt: receivedAt,
        });

        await db.fill.upsert({
          where: { polymarketTradeId: message.id },
          create: {
            polymarketTradeId: message.id,
            marketId: message.market,
            tokenId: message.asset_id,
            side: message.side === "SELL" ? "SELL" : "BUY",
            price: Number(message.price),
            size: Number(message.size),
            source: "CLOB user WS",
            raw: toInputJson(message),
          },
          update: {
            raw: toInputJson(message),
            price: Number(message.price),
            size: Number(message.size),
            source: "CLOB user WS",
          },
        });

        if (message.taker_order_id) {
          await updateLocalOrderStatus(message.taker_order_id, {
            status: OrderStatus.FILLED,
          });
        }

        for (const makerOrderId of makerOrderIds) {
          await updateLocalOrderStatus(makerOrderId, {
            status: OrderStatus.PARTIALLY_FILLED,
          });
        }
      }
    }

    await this.monitorFreshness();
  }

  private mapOrderStatus(status: string | undefined, sizeMatched: string | undefined, originalSize: string | undefined) {
    const upper = status?.toUpperCase();
    if (upper?.includes("CANCEL")) return OrderStatus.CANCELLED;
    if (upper?.includes("REJECT")) return OrderStatus.REJECTED;
    if (upper?.includes("FILLED")) return OrderStatus.FILLED;
    if (upper?.includes("MATCHED")) {
      if (Number(sizeMatched ?? 0) >= Number(originalSize ?? 0) && Number(originalSize ?? 0) > 0) {
        return OrderStatus.FILLED;
      }
      return Number(sizeMatched ?? 0) > 0 ? OrderStatus.PARTIALLY_FILLED : OrderStatus.SUBMITTED;
    }
    return Number(sizeMatched ?? 0) > 0 ? OrderStatus.PARTIALLY_FILLED : OrderStatus.SUBMITTED;
  }

  private async monitorFreshness() {
    const runtime = await this.getRuntime();
    const now = Date.now();
    const latestMarketActivity = Math.max(
      this.health.lastMarketMessageAt?.getTime() ?? 0,
      this.health.lastMarketReconciledAt?.getTime() ?? 0,
    );
    const latestUserActivity = Math.max(
      this.health.lastUserMessageAt?.getTime() ?? 0,
      this.health.lastUserReconciledAt?.getTime() ?? 0,
    );

    const marketStale =
      this.trackedTokenIds.size > 0 &&
      (latestMarketActivity === 0 || now - latestMarketActivity > runtime.maxMarketDataStalenessMs);
    const userStale =
      this.trackedConditionIds.size > 0 &&
      (latestUserActivity === 0 || now - latestUserActivity > runtime.maxUserStateStalenessMs);

    const blockReason = this.health.reconciling
      ? this.health.blockReason ?? "reconcile_required"
      : marketStale
        ? "stale_market_data"
        : userStale
          ? "stale_user_data"
          : null;

    const tradingBlocked = this.health.reconciling || marketStale || userStale;
    const blockTransition = tradingBlocked !== this.health.tradingBlocked;

    await this.patchHealth({
      marketStale,
      userStale,
      tradingBlocked,
      blockReason,
      lastHeartbeatAt: new Date(),
    });

    if (blockTransition && tradingBlocked) {
      await this.applyStrategyStalenessControls(blockReason ?? "stale_data");
    }

    if (blockTransition && !tradingBlocked) {
      await db.strategy.updateMany({
        where: { systemPausedAt: { not: null } },
        data: {
          systemPausedAt: null,
          systemPauseReason: null,
        },
      });
    }
  }

  private async applyStrategyStalenessControls(reason: string) {
    const strategies = await db.strategy.findMany({
      where: {
        enabled: true,
        dryRun: false,
        OR: [
          { pauseOnStaleData: true },
          { cancelOpenOrdersOnStaleData: true },
        ],
      },
      select: {
        id: true,
        pauseOnStaleData: true,
        cancelOpenOrdersOnStaleData: true,
      },
    });

    for (const strategy of strategies) {
      if (strategy.pauseOnStaleData) {
        await db.strategy.update({
          where: { id: strategy.id },
          data: {
            systemPausedAt: new Date(),
            systemPauseReason: reason,
          },
        });
      }

      if (strategy.cancelOpenOrdersOnStaleData) {
        const openOrders = await db.order.findMany({
          where: {
            strategyId: strategy.id,
            dryRun: false,
            status: { in: [OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED] },
          },
        });

        for (const order of openOrders) {
          await db.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELLED },
          });
        }
      }
    }
  }
}

declare global {
  var __pmTraderWsSupervisor: PolymarketStreamSupervisor | undefined;
}

function getSupervisor() {
  if (!globalThis.__pmTraderWsSupervisor) {
    globalThis.__pmTraderWsSupervisor = new PolymarketStreamSupervisor();
  }
  return globalThis.__pmTraderWsSupervisor;
}

export function startPolymarketStreams() {
  getSupervisor().start();
}

export async function ensurePolymarketTargetsTracked(input: Array<{ marketId?: string; tokenId?: string; conditionId?: string }>) {
  await getSupervisor().ensureTargetsTracked(input);
}

export async function reconcileTradingState(reason: ReconcileReason) {
  await getSupervisor().reconcile(reason);
}

export async function getTradingTransportHealth() {
  return getSupervisor().getHealth();
}

export function getLiveMarketSnapshot(tokenId: string) {
  return getSupervisor().getMarketSnapshot(tokenId);
}

export function getLiveUserSnapshot() {
  return getSupervisor().getUserStateSnapshot();
}
