import { Suspense } from "react";

import { syncTradingViewsAction } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { ShellPage } from "@/components/market-pages";
import { StatCard } from "@/components/ui/primitives";
import {
  OrdersWorkbench,
  type PositionRow,
  type OpenOrderRow,
  type HistoryRow,
} from "@/components/orders/orders-workbench";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getPositions } from "@/lib/polymarket/data";
import { listOpenOrders, listTrades } from "@/lib/polymarket/clob-trading";
import { isTradingConfigured } from "@/lib/polymarket/server-config";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const tradingConfigured = isTradingConfigured();

  const [localOrders, localFills, remoteOpenOrders, remoteTrades, rawPositions] =
    await Promise.all([
      db.order.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      db.fill.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      tradingConfigured ? listOpenOrders().catch(() => []) : Promise.resolve([]),
      tradingConfigured ? listTrades().catch(() => []) : Promise.resolve([]),
      getPositions(env.POLYMARKET_TRADER_ADDRESS || undefined).catch(() => []),
    ]);

  const positions: PositionRow[] = rawPositions.map((p, i) => ({
    id: String(p.asset ?? p.asset_id ?? i),
    title: String(p.title ?? p.conditionId ?? "Position"),
    conditionId: String(p.conditionId ?? "--"),
    asset: String(p.asset ?? p.asset_id ?? "--"),
    size: String(p.size ?? 0),
    currentValue: String(p.currentValue ?? p.size ?? 0),
    outcome: p.outcome ? String(p.outcome) : undefined,
  }));

  // --- Transform open orders ---
  const openOrders: OpenOrderRow[] = [
    // Remote CLOB open orders
    ...remoteOpenOrders.map((o) => ({
      id: String(o.id),
      source: "clob" as const,
      market: String(o.market ?? "--"),
      side: String(o.side ?? "--"),
      price: String(o.price ?? 0),
      size: String(o.original_size ?? 0),
      status: String(o.status ?? "LIVE"),
      createdAt: undefined as string | undefined,
    })),
    // Local DB orders that are still active
    ...localOrders
      .filter((o) =>
        ["PENDING", "SUBMITTED", "PARTIALLY_FILLED"].includes(o.status),
      )
      .map((o) => ({
        id: o.id,
        source: "local" as const,
        market: o.marketId,
        side: o.side,
        price: String(o.price),
        size: String(o.size),
        status: o.status,
        createdAt: formatDate(o.createdAt),
        dryRun: o.dryRun,
      })),
  ];

  // --- Transform history ---
  const history: HistoryRow[] = [
    // Remote CLOB trade history
    ...remoteTrades.map((t) => ({
      id: String(t.id),
      source: "clob-trade" as const,
      market: String(t.market ?? "--"),
      side: String(t.side ?? "--"),
      price: String(t.price ?? 0),
      size: String(t.size ?? 0),
      traderSide: t.trader_side ? String(t.trader_side) : undefined,
    })),
    // Local completed/rejected orders
    ...localOrders
      .filter((o) =>
        ["FILLED", "REJECTED", "CANCELLED", "UNKNOWN"].includes(o.status),
      )
      .map((o) => ({
        id: o.id,
        source: "local-order" as const,
        market: o.marketId,
        side: o.side,
        price: String(o.price),
        size: String(o.size),
        status: o.status,
        createdAt: formatDate(o.createdAt),
      })),
    // Local fills
    ...localFills.map((f) => ({
      id: f.id,
      source: "local-fill" as const,
      market: f.marketId,
      side: f.side,
      price: String(f.price),
      size: String(f.size),
      fillSource: f.source,
      createdAt: formatDate(f.createdAt),
    })),
  ];

  return (
    <ShellPage
      eyebrow="Orders / Trades / Positions"
      title="订单与持仓"
      description="统一订单工作台。Positions / Open Orders / History 通过顶部 tab 切换，每条记录标注数据来源。"
      actions={
        <form action={syncTradingViewsAction}>
          <SubmitButton pendingLabel="同步中...">同步远端视图</SubmitButton>
        </form>
      }
    >
      {/* Summary stats */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="positions" value={positions.length} hint="Data API" />
        <StatCard label="open orders" value={openOrders.length} hint="CLOB + Local" />
        <StatCard
          label="history"
          value={history.length}
          hint="CLOB trades + Local"
        />
        <StatCard
          label="local orders"
          value={localOrders.length}
          hint="Local DB"
        />
        <StatCard
          label="local fills"
          value={localFills.length}
          hint="Local DB"
        />
      </div>

      {/* Tabbed workbench (client component) */}
      <Suspense fallback={<div className="card min-h-[320px] animate-pulse rounded-[24px]" />}>
        <OrdersWorkbench
          positions={positions}
          openOrders={openOrders}
          history={history}
          tradingConfigured={tradingConfigured}
        />
      </Suspense>
    </ShellPage>
  );
}
