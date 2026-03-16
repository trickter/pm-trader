import { syncTradingViewsAction } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { ShellPage } from "@/components/market-pages";
import { EmptyState, SectionCard, StatCard, StatusPill } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getPositions } from "@/lib/polymarket/data";
import { listOpenOrders, listTrades } from "@/lib/polymarket/clob-trading";
import { isTradingConfigured } from "@/lib/polymarket/server-config";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [localOrders, localFills, remoteOpenOrders, remoteTrades, positions] = await Promise.all([
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.fill.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    isTradingConfigured() ? listOpenOrders().catch(() => []) : Promise.resolve([]),
    isTradingConfigured() ? listTrades().catch(() => []) : Promise.resolve([]),
    getPositions(env.POLYMARKET_TRADER_ADDRESS || undefined).catch(() => []),
  ]);

  return (
    <ShellPage
      eyebrow="Orders / Trades / Positions"
      title="订单与持仓"
      description="页面同时展示本地审计数据和官方远端读取结果。每个区块都标明数据来源，官方没有的字段不补假数据。"
      actions={
        <form action={syncTradingViewsAction}>
          <SubmitButton pendingLabel="同步中...">同步远端视图</SubmitButton>
        </form>
      }
    >
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="local orders" value={localOrders.length} hint="来源: local DB" />
        <StatCard label="local fills" value={localFills.length} hint="来源: local DB" />
        <StatCard label="open orders" value={remoteOpenOrders.length} hint="来源: CLOB auth" />
        <StatCard label="trade history" value={remoteTrades.length} hint="来源: CLOB auth" />
        <StatCard label="positions" value={positions.length} hint="来源: Data API" />
      </div>

      {!isTradingConfigured() ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-[var(--line)] px-5 py-4 text-sm text-[var(--muted)]">
          当前没有配置服务端交易凭据，因此 CLOB open orders / trade history 只显示空态。本地 dry-run 订单与公开 Data positions 仍可查看。
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Open Orders" description="来源: CLOB auth">
          <div className="space-y-3">
            {remoteOpenOrders.length === 0 ? (
              <EmptyState title="暂无 open orders" description="如果已经配置凭据但仍为空，说明当前账户没有未完成订单。" />
            ) : (
              remoteOpenOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>{order.market}</span>
                    <StatusPill tone="good">{order.status}</StatusPill>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">
                    {order.side} {formatNumber(order.original_size)} @ {formatNumber(order.price)}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Trade History" description="来源: CLOB auth">
          <div className="space-y-3">
            {remoteTrades.length === 0 ? (
              <EmptyState title="暂无 trade history" description="只有认证成功后，才会读取官方账户成交记录。" />
            ) : (
              remoteTrades.map((trade) => (
                <div key={trade.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>{trade.market}</span>
                    <StatusPill tone="good">{trade.trader_side}</StatusPill>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">
                    {trade.side} {formatNumber(trade.size)} @ {formatNumber(trade.price)}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Order History" description="来源: local DB">
          <div className="space-y-3">
            {localOrders.length === 0 ? (
              <EmptyState title="暂无本地订单" description="手工下单或 live 策略单都会在本地落审计记录。" />
            ) : (
              localOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>{order.marketId}</span>
                    <StatusPill tone={order.status === "REJECTED" ? "danger" : "good"}>{order.status}</StatusPill>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">
                    {order.side} {formatNumber(order.size)} @ {formatNumber(order.price)} · {formatDate(order.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Positions" description="来源: Data API">
          <div className="space-y-3">
            {positions.length === 0 ? (
              <EmptyState title="暂无 positions" description="需要配置 `POLYMARKET_TRADER_ADDRESS`，且该地址在 Data API 中有可读持仓。" />
            ) : (
              positions.map((position, index) => (
                <div key={`${String(position.asset ?? index)}-${index}`} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>{String(position.title ?? position.conditionId ?? "position")}</span>
                    <StatusPill tone="neutral">Data API</StatusPill>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">
                    size {formatNumber(String(position.size ?? position.currentValue ?? 0))} · asset {String(position.asset ?? position.asset_id ?? "--")}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Local Fill History" description="来源: local DB">
        <div className="space-y-3">
          {localFills.length === 0 ? (
            <EmptyState title="暂无 local fills" description="只有确认写入本地的 fill 才会出现在这里。" />
          ) : (
            localFills.map((fill) => (
              <div key={fill.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span>{fill.marketId}</span>
                  <StatusPill tone="good">{fill.source}</StatusPill>
                </div>
                <p className="mt-2 text-[var(--muted)]">
                  {fill.side} {formatNumber(fill.size)} @ {formatNumber(fill.price)} · {formatDate(fill.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </ShellPage>
  );
}
