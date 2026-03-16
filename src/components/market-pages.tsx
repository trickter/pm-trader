import Link from "next/link";

import { AppShell } from "@/components/ui/shell";
import { CopyableId } from "@/components/ui/display";
import { EmptyState, PageHeader, SectionCard, StatCard, StatusPill, TextInput } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatCompactNumber, formatNumber, parseJsonArray, truncateText } from "@/lib/utils";

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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard label="状态" value={<StatusPill tone={market.active ? "good" : market.closed ? "warn" : "neutral"}>{market.active ? "Active" : market.closed ? "Closed" : "Unknown"}</StatusPill>} hint="Gamma" />
      <StatCard label="最新价格" value={formatNumber(quote?.lastTradePrice)} hint="CLOB last trade" />
      <StatCard label="买一 / 卖一" value={`${formatNumber(quote?.bestBid)} / ${formatNumber(quote?.bestAsk)}`} hint="CLOB orderbook" />
      <StatCard label="点差" value={formatNumber(quote?.spread)} hint="CLOB spread" />
      <StatCard label="中间价" value={formatNumber(quote?.midpoint)} hint="CLOB midpoint" />
      <StatCard label="总成交量" value={formatCompactNumber(market.volume)} hint="Gamma volume" />
      <StatCard label="24h 成交量" value={formatCompactNumber(market.volume24hr)} hint="Gamma volume24hr" />
      <StatCard label="流动性" value={formatCompactNumber(market.liquidity)} hint="Gamma liquidity" />
      <StatCard label="最小下单量" value={formatNumber(market.orderMinSize)} hint="Gamma / CLOB" />
      <StatCard label="最小 tick" value={formatNumber(market.orderPriceMinTickSize)} hint="Gamma tick size" />
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
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-base font-semibold leading-snug">{event.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                <span className="truncate font-mono" title={event.slug}>{truncateText(event.slug, 32)}</span>
                <span className="shrink-0">vol: {formatCompactNumber(event.volume)}</span>
              </div>
            </div>
            <StatusPill tone={event.active ? "good" : event.closed ? "warn" : "neutral"}>
              {event.active ? "Active" : event.closed ? "Closed" : "Unknown"}
            </StatusPill>
          </div>
          {(event.markets ?? []).length > 0 && (
            <div className="mt-4 space-y-2">
              {(event.markets ?? []).slice(0, 6).map((market) => (
                <Link
                  key={market.id}
                  href={`/markets/${market.id}`}
                  className="block rounded-2xl border border-[var(--line)] px-4 py-2.5 text-sm leading-snug hover:border-[var(--accent)]"
                >
                  <span className="line-clamp-2">{market.question}</span>
                </Link>
              ))}
            </div>
          )}
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
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {markets.map((market) => (
        <Link key={market.id} href={`/markets/${market.id}`} className="card flex flex-col rounded-[24px] p-5 transition hover:-translate-y-0.5">
          <div className="flex items-start gap-3">
            <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug">{market.question}</h3>
            <StatusPill tone={market.active ? "good" : market.closed ? "warn" : "neutral"}>
              {market.active ? "Active" : market.closed ? "Closed" : "Unknown"}
            </StatusPill>
          </div>
          <p className="mt-2 truncate font-mono text-xs text-[var(--muted)]" title={market.slug}>
            {truncateText(market.slug, 36)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-3 text-sm">
            <div>
              <p className="text-xs text-[var(--muted)]">Liquidity</p>
              <p className="mt-0.5 font-medium">{formatCompactNumber(market.liquidity)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Volume</p>
              <p className="mt-0.5 font-medium">{formatCompactNumber(market.volume)}</p>
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
  copyable,
}: {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
}) {
  const isString = typeof value === "string";

  return (
    <div className="flex min-h-[72px] flex-col justify-between rounded-2xl border border-[var(--line)] px-4 py-3">
      <p className="shrink-0 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 min-w-0">
        {copyable && isString ? (
          <CopyableId value={value} startLen={8} endLen={6} />
        ) : isString && value.length > 50 ? (
          <p className="truncate font-mono text-xs" title={value}>{value}</p>
        ) : (
          <p className="truncate text-sm" title={isString ? value : undefined}>{value}</p>
        )}
      </div>
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
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 px-4 py-1 text-xs uppercase tracking-wider text-[var(--muted)]">
          <span>Price</span>
          <span className="text-right">Size</span>
        </div>
        {levels.slice(0, 10).map((level, index) => (
          <div
            key={`${title}-${index}-${level.price}`}
            className={`grid grid-cols-2 rounded-xl px-4 py-2.5 font-mono text-sm ${tone === "buy" ? "bg-[var(--accent-soft)]" : "bg-[var(--danger-soft)]"}`}
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
    <form className="card mb-6 flex flex-wrap items-center gap-4 rounded-[24px] p-5">
      <div className="min-w-0 flex-1">
        <TextInput name="q" defaultValue={defaultQuery} placeholder="搜索 event / market / profile" />
      </div>
      <label className="flex shrink-0 items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2.5 text-sm">
        <input type="checkbox" name="active" defaultChecked={active} />
        active
      </label>
      <label className="flex shrink-0 items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2.5 text-sm">
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
            <span className="font-medium">{outcome}</span>
            {tokenIds[index] ? (
              <CopyableId value={tokenIds[index]} startLen={8} endLen={6} />
            ) : (
              <span className="text-xs text-[var(--muted)]">--</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
