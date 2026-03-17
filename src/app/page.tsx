import { runEngineNowAction } from "@/app/actions";
import { ShellPage, MarketStats } from "@/components/market-pages";
import { SectionCard, StatCard, StatusPill, EmptyState } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/forms/submit-button";
import { getDashboardState, getRiskSettings } from "@/lib/db/settings";
import { discoverMarkets } from "@/lib/polymarket/gamma";
import { getMarketQuote } from "@/lib/polymarket/clob-public";
import { getLiveMarketSnapshot } from "@/lib/polymarket/ws";
import { getTradingReadiness } from "@/lib/trading/readiness";
import { formatDate, formatNumber, truncateHash } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboard, risk, markets, readiness] = await Promise.all([
    getDashboardState(),
    getRiskSettings(),
    discoverMarkets({ active: true, closed: false, limit: 6 }),
    getTradingReadiness(),
  ]);

  const selectedMarket = markets[0];
  const selectedToken = selectedMarket?.clobTokenIds ? JSON.parse(selectedMarket.clobTokenIds)[0] : null;
  const liveQuote = selectedToken ? getLiveMarketSnapshot(selectedToken) : null;
  const quote =
    liveQuote ??
    (selectedToken ? await getMarketQuote(selectedToken).catch(() => null) : null);

  return (
    <ShellPage
      eyebrow="Step 5 / MVP"
      title="Dashboard"
      description="系统概览页把实时行情和策略状态拆开展示。策略引擎只在服务端运行，页面只做查询与触发。"
      actions={
        <form action={runEngineNowAction}>
          <SubmitButton pendingLabel="运行中...">立即跑一次策略引擎</SubmitButton>
        </form>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="策略总数" value={dashboard.strategiesCount} hint="来源: local DB" />
        <StatCard label="启用策略" value={dashboard.enabledStrategiesCount} hint="来源: local DB" />
        <StatCard label="紧急停止" value={<StatusPill tone={risk.emergencyStop ? "danger" : "good"}>{risk.emergencyStop ? "ON" : "OFF"}</StatusPill>} hint="来源: local DB risk settings" />
        <StatCard label="交易闸门" value={<StatusPill tone={readiness.ready ? "good" : "danger"}>{readiness.ready ? "READY" : "BLOCKED"}</StatusPill>} hint={readiness.blockReason ?? "market+user freshness"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <SectionCard title="实时行情" description="来源: market WebSocket 主链路；缺失时短时回退 HTTP snapshot。这里只展示选中市场的最新盘口，不混入策略状态。">
          {selectedMarket && quote ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-[var(--muted)]">{selectedMarket.question}</p>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]" title={selectedMarket.id}>marketId: {truncateHash(selectedMarket.id, 8, 6)}</p>
              </div>
              <MarketStats market={selectedMarket} quote={quote ?? undefined} />
            </div>
          ) : (
            <EmptyState title="暂无实时行情" description="没有可用 market / token，或当前行情请求失败。" />
          )}
        </SectionCard>

        <SectionCard title="策略状态" description="来源: local DB。这里只展示策略与执行结果，不直接混入盘口数据。">
          <div className="space-y-3">
            {dashboard.latestSignals.length === 0 ? (
              <EmptyState title="暂无信号" description="先创建并启用策略，再运行一次服务端引擎。" />
            ) : (
              dashboard.latestSignals.map((signal) => (
                <div key={signal.id} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{signal.signalType}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{signal.reason}</p>
                    </div>
                    <StatusPill tone={signal.executed ? "good" : "warn"}>{signal.executed ? "executed" : "logged"}</StatusPill>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">{formatDate(signal.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="最近订单" description="来源: local DB">
          <div className="space-y-3">
            {dashboard.latestOrders.length === 0 ? (
              <EmptyState title="暂无订单" description="dry-run 信号不会走真实下单。启用 live 或手工下单后这里会出现记录。" />
            ) : (
              dashboard.latestOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-xs" title={order.marketId}>{truncateHash(order.marketId, 8, 6)}</span>
                    <StatusPill tone={order.status === "REJECTED" ? "danger" : "good"}>{order.status}</StatusPill>
                  </div>
                  <p className="mt-1.5 text-[var(--muted)]">
                    {order.side} {formatNumber(order.size)} @ {formatNumber(order.price)}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="最近成交" description="来源: local DB fills">
          <div className="space-y-3">
            {dashboard.latestFills.length === 0 ? (
              <EmptyState title="暂无成交" description="只有确认落库的 fill 才会出现在这里。" />
            ) : (
              dashboard.latestFills.map((fill) => (
                <div key={fill.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-xs" title={fill.marketId}>{truncateHash(fill.marketId, 8, 6)}</span>
                    <StatusPill tone="good">{fill.source}</StatusPill>
                  </div>
                  <p className="mt-1.5 text-[var(--muted)]">
                    {fill.side} {formatNumber(fill.size)} @ {formatNumber(fill.price)}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </ShellPage>
  );
}
