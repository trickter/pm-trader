import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { discoverMarkets } from "@/lib/polymarket/gamma";
import { getMarketQuotePreferWs } from "@/lib/polymarket/clob-public";
import type { GammaMarket, ClobOrderBook } from "@/lib/polymarket/types";
import type { DiscoveryQueryScopeParams } from "@/lib/strategy/config";
import type { TwoSidedRangeQuotingParams } from "@/lib/strategy/types";
import { toInputJson } from "@/lib/utils";

export type MarketSuitabilityResult = {
  marketId: string;
  question: string;
  score: number;
  priceRangeScore: number;
  liquidityScore: number;
  volumeScore: number;
  bookDepthScore: number;
  spreadScore: number;
  timeToExpiryScore: number;
  qualified: boolean;
  reason: string;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;
  yesTokenId: string | null;
  noTokenId: string | null;
};

export type MarketScanDiagnostics = {
  fetchedMarkets: number;
  pagesScanned: number;
  hardFilteredMarkets: number;
  quoteFetchAttempts: number;
  quoteFetchFailures: number;
  scoredMarkets: number;
  rejectedByPriceRange: number;
  rejectedByLiquidity: number;
  rejectedByVolume: number;
  rejectedByBookDepth: number;
  rejectedBySpread: number;
  rejectedByExpiry: number;
  qualifiedMarkets: number;
  error?: string;
};

export type MarketScanResult = {
  results: MarketSuitabilityResult[];
  diagnostics: MarketScanDiagnostics;
};

// Weights for suitability scoring (sum = 100)
const WEIGHTS = {
  priceRange: 25,
  liquidity: 15,
  volume: 15,
  bookDepth: 15,
  spread: 15,
  timeToExpiry: 15,
};

function parseTokenIds(market: GammaMarket): { yesTokenId: string | null; noTokenId: string | null } {
  if (!market.clobTokenIds) return { yesTokenId: null, noTokenId: null };
  try {
    const ids = JSON.parse(market.clobTokenIds);
    if (Array.isArray(ids) && ids.length >= 2) {
      return { yesTokenId: String(ids[0]), noTokenId: String(ids[1]) };
    }
    if (Array.isArray(ids) && ids.length === 1) {
      return { yesTokenId: String(ids[0]), noTokenId: null };
    }
  } catch { /* ignore */ }
  return { yesTokenId: null, noTokenId: null };
}

function scorePriceRange(midPrice: number, entryLow: number, entryHigh: number): number {
  // Best score when midPrice is centered in entry band
  const entryCenter = (entryLow + entryHigh) / 2;
  const entryBandWidth = (entryHigh - entryLow) / 2;

  // Score based on proximity to the entry center, with some tolerance
  // Also reject extremes (< 0.15 or > 0.85)
  if (midPrice < 0.15 || midPrice > 0.85) return 0;

  // Within entry band → perfect score
  if (midPrice >= entryLow && midPrice <= entryHigh) return 100;

  // Within broader "actionable" range (up to 2x band width from center)
  const distance = Math.abs(midPrice - entryCenter);
  const maxDistance = entryBandWidth * 4;
  if (distance > maxDistance) return 0;

  return Math.round(100 * (1 - distance / maxDistance));
}

function scoreLiquidity(liquidity: number, minLiquidity: number): number {
  if (liquidity < minLiquidity) return 0;
  // Logarithmic scale: 2x minimum → 75, 10x minimum → 100
  const ratio = liquidity / minLiquidity;
  return Math.min(100, Math.round(75 * Math.log10(ratio) / Math.log10(2) + 25));
}

function scoreVolume(volume24h: number, minVolume: number): number {
  if (volume24h < minVolume) return 0;
  const ratio = volume24h / minVolume;
  return Math.min(100, Math.round(75 * Math.log10(ratio) / Math.log10(2) + 25));
}

function scoreBookDepth(book: ClobOrderBook, minDepth: number): number {
  const bidDepth = book.bids.slice(0, 3).reduce((sum, level) => sum + Number(level.size), 0);
  const askDepth = book.asks.slice(0, 3).reduce((sum, level) => sum + Number(level.size), 0);
  const totalDepth = bidDepth + askDepth;
  if (totalDepth < minDepth) return 0;
  const ratio = totalDepth / minDepth;
  return Math.min(100, Math.round(50 + 50 * Math.min(ratio / 5, 1)));
}

function scoreSpread(spread: number, maxSpread: number): number {
  if (spread > maxSpread) return 0;
  if (spread <= 0.005) return 100;
  // Linear: 0 spread → 100, maxSpread → 30
  return Math.round(100 - 70 * (spread / maxSpread));
}

function scoreTimeToExpiry(endDate: string | null | undefined, minMinutes: number): number {
  if (!endDate) return 50; // No end date → perpetual-like, moderate score
  const msRemaining = new Date(endDate).getTime() - Date.now();
  const minutesRemaining = msRemaining / 60000;
  if (minutesRemaining < minMinutes) return 0;
  // 3x minimum → 80, 10x+ → 100
  const ratio = minutesRemaining / minMinutes;
  if (ratio >= 10) return 100;
  return Math.round(30 + 70 * Math.min(ratio / 10, 1));
}

/**
 * Scan markets and return suitability results for range quoting.
 *
 * This function:
 * 1. Fetches active markets from Gamma API
 * 2. Applies hard filters (active, accepting orders, has token IDs)
 * 3. Fetches orderbook for qualifying markets
 * 4. Scores each market on multiple dimensions
 * 5. Returns scored results sorted by score descending
 */
export async function scanMarketsForRangeQuoting(
  params: TwoSidedRangeQuotingParams,
  scope: DiscoveryQueryScopeParams,
  options: { limit?: number } = {},
): Promise<MarketScanResult> {
  const limit = options.limit ?? scope.maxMarketsTracked * 3;
  const pageSize = 100;
  const maxPages = Math.max(1, Math.ceil(Math.max(limit * 8, 300) / pageSize));
  const diagnostics: MarketScanDiagnostics = {
    fetchedMarkets: 0,
    pagesScanned: 0,
    hardFilteredMarkets: 0,
    quoteFetchAttempts: 0,
    quoteFetchFailures: 0,
    scoredMarkets: 0,
    rejectedByPriceRange: 0,
    rejectedByLiquidity: 0,
    rejectedByVolume: 0,
    rejectedByBookDepth: 0,
    rejectedBySpread: 0,
    rejectedByExpiry: 0,
    qualifiedMarkets: 0,
  };

  const markets: GammaMarket[] = [];
  try {
    for (let page = 0; page < maxPages; page += 1) {
      const batch = await discoverMarkets({
        active: true,
        closed: false,
        limit: pageSize,
        offset: page * pageSize,
        order: "liquidity",
        ascending: false,
      });
      diagnostics.pagesScanned += 1;
      markets.push(...batch);
      if (batch.length < pageSize) {
        break;
      }
    }
  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : String(error);
    logger.error("market scan failed", { error: diagnostics.error });
    return { results: [], diagnostics };
  }
  diagnostics.fetchedMarkets = markets.length;

  // Hard filter: must be active, accepting orders, have token IDs
  const candidates = markets.filter((m) => {
    if (!m.active || m.closed) return false;
    if (m.acceptingOrders === false) return false;
    const { yesTokenId } = parseTokenIds(m);
    if (!yesTokenId) return false;

    // Time to expiry check
    if (m.endDate) {
      const msRemaining = new Date(m.endDate).getTime() - Date.now();
      if (msRemaining < scope.minTimeToExpiryMinutes * 60000) return false;
    }

    // Liquidity floor
    const liq = Number(m.liquidity ?? 0);
    if (liq < scope.minLiquidity) return false;

    return true;
  });
  diagnostics.hardFilteredMarkets = candidates.length;

  // Score each candidate (fetch orderbook in parallel, batched to avoid overwhelming API)
  const results: MarketSuitabilityResult[] = [];
  const batchSize = 5;

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (market) => {
        const { yesTokenId, noTokenId } = parseTokenIds(market);
        if (!yesTokenId) return null;

        let quote;
        try {
          diagnostics.quoteFetchAttempts += 1;
          quote = await getMarketQuotePreferWs(yesTokenId);
        } catch {
          diagnostics.quoteFetchFailures += 1;
          return null;
        }

        const bestBid = Number(quote.bestBid);
        const bestAsk = Number(quote.bestAsk);
        const midPrice = (bestBid + bestAsk) / 2;
        const spread = Number(quote.spread);

        // Compute sub-scores
        const priceRangeScore = scorePriceRange(midPrice, params.entryLow, params.entryHigh);
        const liquidityScore = scoreLiquidity(Number(market.liquidity ?? 0), scope.minLiquidity);
        const volumeScore = scoreVolume(Number(market.volume24hr ?? market.volume ?? 0), scope.minVolume24h);
        const bookDepthScore = scoreBookDepth(quote.book, scope.minBookDepth);
        const spreadScore = scoreSpread(spread, scope.maxSpread);
        const timeToExpiryScore = scoreTimeToExpiry(market.endDate, scope.minTimeToExpiryMinutes);
        diagnostics.scoredMarkets += 1;

        // Weighted total
        const score = Math.round(
          (priceRangeScore * WEIGHTS.priceRange +
            liquidityScore * WEIGHTS.liquidity +
            volumeScore * WEIGHTS.volume +
            bookDepthScore * WEIGHTS.bookDepth +
            spreadScore * WEIGHTS.spread +
            timeToExpiryScore * WEIGHTS.timeToExpiry) /
            100,
        );

        // Qualification: score >= 40 and no hard-fail sub-scores
        const hardFails: string[] = [];
        if (priceRangeScore === 0) {
          diagnostics.rejectedByPriceRange += 1;
          hardFails.push("price out of range");
        }
        if (liquidityScore === 0) {
          diagnostics.rejectedByLiquidity += 1;
          hardFails.push("insufficient liquidity");
        }
        if (volumeScore === 0) {
          diagnostics.rejectedByVolume += 1;
        }
        if (bookDepthScore === 0) {
          diagnostics.rejectedByBookDepth += 1;
        }
        if (spreadScore === 0) {
          diagnostics.rejectedBySpread += 1;
          hardFails.push("spread too wide");
        }
        if (timeToExpiryScore === 0) {
          diagnostics.rejectedByExpiry += 1;
          hardFails.push("too close to expiry");
        }

        const qualified = score >= 40 && hardFails.length === 0;
        if (qualified) {
          diagnostics.qualifiedMarkets += 1;
        }
        const reason = qualified
          ? `Score ${score}: qualified`
          : `Score ${score}: ${hardFails.join(", ") || "below threshold"}`;

        return {
          marketId: market.id,
          question: market.question,
          score,
          priceRangeScore,
          liquidityScore,
          volumeScore,
          bookDepthScore,
          spreadScore,
          timeToExpiryScore,
          qualified,
          reason,
          bestBid,
          bestAsk,
          midPrice,
          spread,
          yesTokenId,
          noTokenId,
        };
      }),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return { results, diagnostics };
}

/**
 * Persist suitability snapshots to the database for audit/monitoring.
 */
export async function saveMarketSuitabilitySnapshots(
  results: MarketSuitabilityResult[],
  strategyId?: string,
) {
  await Promise.all(
    results.slice(0, 20).map((r) =>
      db.marketSuitability.create({
        data: {
          marketId: r.marketId,
          strategyId: strategyId ?? null,
          score: r.score,
          priceRangeScore: r.priceRangeScore,
          liquidityScore: r.liquidityScore,
          volumeScore: r.volumeScore,
          bookDepthScore: r.bookDepthScore,
          spreadScore: r.spreadScore,
          timeToExpiry: r.timeToExpiryScore,
          qualified: r.qualified,
          reason: r.reason,
          snapshot: toInputJson({
            bestBid: r.bestBid,
            bestAsk: r.bestAsk,
            midPrice: r.midPrice,
            spread: r.spread,
            question: r.question,
            yesTokenId: r.yesTokenId,
            noTokenId: r.noTokenId,
          }),
        },
      }),
    ),
  );
}
