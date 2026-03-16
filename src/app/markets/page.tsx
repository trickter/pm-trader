import { discoverEvents, discoverMarkets, searchPolymarket } from "@/lib/polymarket/gamma";
import { ShellPage, EventList, MarketGrid, SearchToolbar } from "@/components/market-pages";
import { SectionCard, EmptyState, StatusPill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const active = params.active === undefined ? true : params.active === "on";
  const closed = params.closed === "on";

  const [events, markets, searchResult] = await Promise.all([
    discoverEvents({ active, closed, limit: 8 }),
    discoverMarkets({ active, closed, limit: 12 }),
    q ? searchPolymarket(q) : Promise.resolve(null),
  ]);

  return (
    <ShellPage
      eyebrow="Gamma API"
      title="市场发现"
      description="用官方 Gamma 公共读接口做市场浏览和搜索。当前只接 active / closed / 关键词搜索，tag 精确过滤保留为待人工确认项。"
    >
      <SearchToolbar defaultQuery={q} active={active} closed={closed} />

      {searchResult ? (
        <SectionCard title="搜索结果" description="来源: Gamma public-search">
          <div className="mb-4 flex items-center gap-2 text-sm text-[var(--muted)]">
            <StatusPill tone="neutral">events {searchResult.events.length}</StatusPill>
            <StatusPill tone="neutral">markets {searchResult.markets.length}</StatusPill>
            <StatusPill tone="warn">profiles {searchResult.profiles.length}</StatusPill>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-3 text-base font-semibold">事件结果</h3>
              <EventList events={searchResult.events} />
            </div>
            <div>
              <h3 className="mb-3 text-base font-semibold">市场结果</h3>
              <MarketGrid markets={searchResult.markets} />
            </div>
          </div>
          {searchResult.profiles.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">
              官方 search 返回了 profile 结果，但这版 MVP 不展示未确认字段，只显示数量。
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr,1.2fr]">
        <SectionCard title="事件浏览" description="来源: Gamma events">
          <EventList events={events} />
        </SectionCard>
        <SectionCard title="市场浏览" description="来源: Gamma markets">
          {markets.length === 0 ? <EmptyState title="暂无市场" description="切换筛选条件后重试。" /> : <MarketGrid markets={markets} />}
        </SectionCard>
      </div>
    </ShellPage>
  );
}
