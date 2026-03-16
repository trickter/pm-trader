import Link from "next/link";

import { AppShell } from "@/components/ui/shell";
import { EmptyState, PageHeader, SectionCard, StatCard, StatusPill, TextInput } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatNumber, parseJsonArray } from "@/lib/utils";

export function ShellPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      {children}
    </AppShell>
  );
}

export function MarketStats({
  market,
  quote,
}: {
  market: {
    active?: boolean;
    closed?: boolean;
    liquidity?: string | number | null;
    volume?: string | number | null;
    volume24hr?: number | null;
    orderMinSize?: string | number | null;
    orderPriceMinTickSize?: number | null;
  };
  quote?: {
    bestBid?: string | number;
    bestAsk?: string | number;
    spread?: string | number;
    midpoint?: string | number;
    lastTradePrice?: string | number;
  };
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="状态" value={<StatusPill tone={market.active ? "good" : market.closed ? "warn" : "neutral"}>{market.active ? "Active" : market.closed ? "Closed" : "Unknown"}</StatusPill>} hint="来源: Gamma" />
      <StatCard label="最新价格" value={formatNumber(quote?.lastTradePrice)} hint="来源: CLOB last trade" />
      <StatCard label="买一 / 卖一" value={`${formatNumber(quote?.bestBid)} / ${formatNumber(quote?.bestAsk)}`} hint="来源: CLOB orderbook" />
      <StatCard label="点差" value={formatNumber(quote?.spread)} hint="来源: CLOB spread" />
      <StatCard label="中间价" value={formatNumber(quote?.midpoint)} hint="来源: CLOB midpoint" />
      <StatCard label="总成交量" value={formatNumber(market.volume)} hint="来源: Gamma volume" />
      <StatCard label="24h 成交量" value={formatNumber(market.volume24hr)} hint="来源: Gamma volume24hr" />
      <StatCard label="流动性" value={formatNumber(market.liquidity)} hint="来源: Gamma liquidity" />
      <StatCard label="最小下单量" value={formatNumber(market.orderMinSize)} hint="来源: Gamma / CLOB" />
      <StatCard label="最小 tick" value={formatNumber(market.orderPriceMinTickSize)} hint="来源: Gamma orderPriceMinTickSize" />
    </div>
  );
}

export function EventList({
  events,
}: {
  events: Array<{
    id: string;
    title: string;
    slug: string;
    active?: boolean;
    closed?: boolean;
    volume?: string | number | null;
    markets?: Array<{ id: string; question: string; slug: string }>;
  }>;
}) {
  if (events.length === 0) {
    return <EmptyState title="暂无事件结果" description="试试更换关键词，或关闭筛选条件。" />;
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="card rounded-[24px] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{event.title}</h3>
                <StatusPill tone={event.active ? "good" : event.closed ? "warn" : "neutral"}>
                  {event.active ? "Active" : event.closed ? "Closed" : "Unknown"}
                </StatusPill>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">event slug: {event.slug} · volume: {formatNumber(event.volume)}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {(event.markets ?? []).slice(0, 6).map((market) => (
              <Link key={market.id} href={`/markets/${market.id}`} className="block rounded-2xl border border-[var(--line)] px-4 py-3 text-sm hover:border-[var(--accent)]">
                {market.question}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MarketGrid({
  markets,
}: {
  markets: Array<{
    id: string;
    question: string;
    slug: string;
    active?: boolean;
    closed?: boolean;
    volume?: string | number | null;
    liquidity?: string | number | null;
  }>;
}) {
  if (markets.length === 0) {
    return <EmptyState title="暂无市场结果" description="当前条件下没有查到市场。" />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {markets.map((market) => (
        <Link key={market.id} href={`/markets/${market.id}`} className="card rounded-[24px] p-5 transition hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold">{market.question}</h3>
            <StatusPill tone={market.active ? "good" : market.closed ? "warn" : "neutral"}>
              {market.active ? "Active" : market.closed ? "Closed" : "Unknown"}
            </StatusPill>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">{market.slug}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[var(--muted)]">Liquidity</p>
              <p className="mt-1 font-medium">{formatNumber(market.liquidity)}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">Volume</p>
              <p className="mt-1 font-medium">{formatNumber(market.volume)}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function MarketDetailBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 text-sm">{value}</div>
    </div>
  );
}

export function OrderbookTable({
  title,
  levels,
  tone,
}: {
  title: string;
  levels: Array<{ price: string; size: string }>;
  tone: "buy" | "sell";
}) {
  if (levels.length === 0) {
    return <EmptyState title={`${title} 暂无挂单`} description="当前 token 没有可展示的盘口深度。" />;
  }

  return (
    <SectionCard title={title} description="来源: CLOB orderbook">
      <div className="space-y-2">
        {levels.slice(0, 10).map((level, index) => (
          <div
            key={`${title}-${index}-${level.price}`}
            className={`grid grid-cols-2 rounded-2xl px-4 py-3 text-sm ${tone === "buy" ? "bg-[var(--accent-soft)]" : "bg-[var(--danger-soft)]"}`}
          >
            <span>{formatNumber(level.price)}</span>
            <span className="text-right">{formatNumber(level.size)}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function SearchToolbar({
  defaultQuery,
  active,
  closed,
}: {
  defaultQuery: string;
  active: boolean;
  closed: boolean;
}) {
  return (
    <form className="card mb-6 grid gap-4 rounded-[24px] p-5 md:grid-cols-4">
      <TextInput name="q" defaultValue={defaultQuery} placeholder="搜索 event / market / profile" />
      <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2.5 text-sm">
        <input type="checkbox" name="active" defaultChecked={active} />
        active
      </label>
      <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2.5 text-sm">
        <input type="checkbox" name="closed" defaultChecked={closed} />
        closed
      </label>
      <SubmitButton pendingLabel="搜索中...">查询</SubmitButton>
    </form>
  );
}

export function OutcomeList({
  outcomesRaw,
  tokenIdsRaw,
}: {
  outcomesRaw?: string | null;
  tokenIdsRaw?: string | null;
}) {
  const outcomes = parseJsonArray(outcomesRaw);
  const tokenIds = parseJsonArray(tokenIdsRaw);

  if (outcomes.length === 0) {
    return <EmptyState title="暂无 outcome 映射" description="官方返回里未带 outcomes / token ids。" />;
  }

  return (
    <div className="space-y-2">
      {outcomes.map((outcome, index) => (
        <div key={`${outcome}-${index}`} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>{outcome}</span>
            <span className="font-mono text-xs text-[var(--muted)]">{tokenIds[index] ?? "TODO"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
