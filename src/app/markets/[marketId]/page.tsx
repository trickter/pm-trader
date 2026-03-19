import { placeManualOrderAction } from "@/app/actions/orders";
import { SubmitButton } from "@/components/forms/submit-button";
import { MarketDetailBlock, MarketStats, OrderbookTable, OutcomeList, ShellPage } from "@/components/market-pages";
import { CopyableId } from "@/components/ui/display";
import Link from "next/link";
import { EmptyState, SectionCard, StatusPill, TextInput } from "@/components/ui/primitives";
import { getRuntimeSettings } from "@/lib/db/settings";
import { getMarketQuotePreferWs } from "@/lib/polymarket/clob-public";
import { getMarketById } from "@/lib/polymarket/gamma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ marketId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { marketId } = await params;
  const query = await searchParams;
  const market = await getMarketById(marketId, { skipCache: true });
  const tokenIds = market.clobTokenIds ? JSON.parse(market.clobTokenIds) : [];
  const primaryTokenId = tokenIds[0];
  const runtime = await getRuntimeSettings();
  const quote = primaryTokenId
    ? await getMarketQuotePreferWs(primaryTokenId).catch(() => null)
    : null;
  const orderStatus = getSingleSearchParam(query.orderStatus);
  const orderDetail = getSingleSearchParam(query.orderDetail);

  return (
    <ShellPage
      eyebrow="Market Detail"
      title={market.question}
      description="展示官方确认的市场基础字段、outcome / token 映射、盘口与手工下单。实时行情优先来自服务端 market WebSocket，缺失时短时回退 HTTP snapshot。"
    >
      <div className="space-y-6">
        {orderStatus ? <ManualOrderFeedback marketId={market.id} status={orderStatus} detail={orderDetail} /> : null}

        <SectionCard title="市场概览" description="来源: Gamma + CLOB">
          <MarketStats market={market} quote={quote ?? undefined} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MarketDetailBlock label="market id" value={market.id} copyable />
            <MarketDetailBlock label="condition id" value={market.conditionId ?? "--"} copyable />
            <MarketDetailBlock label="slug" value={market.slug} />
            <MarketDetailBlock label="时间范围" value={`${formatDate(market.startDate)} — ${formatDate(market.endDate)}`} />
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <SectionCard title="Outcome / Token 映射" description="来源: Gamma outcomes + clobTokenIds">
            <OutcomeList outcomesRaw={market.outcomes} tokenIdsRaw={market.clobTokenIds} />
          </SectionCard>

          <SectionCard title="手工限价单" description="按官方语义只提交 limit order，不伪造 market order。">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <StatusPill tone={runtime.defaultDryRun ? "warn" : "danger"}>
                {runtime.defaultDryRun ? "dry-run" : "live"}
              </StatusPill>
              <span className="text-[var(--muted)]">
                {runtime.defaultDryRun
                  ? "当前只写本地订单记录，不会真实发单到 Polymarket。"
                  : "当前会真实提交到 Polymarket。"}
              </span>
            </div>
            {primaryTokenId ? (
              <form action={placeManualOrderAction} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="marketId" value={market.id} />
                <input type="hidden" name="tokenId" value={primaryTokenId} />
                <label className="text-sm">
                  <span className="mb-2 block text-[var(--muted)]">tokenId</span>
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
                    <CopyableId value={primaryTokenId} startLen={10} endLen={8} />
                  </div>
                </label>
                <label className="text-sm">
                  <span className="mb-2 block text-[var(--muted)]">side</span>
                  <select name="side" className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-2 block text-[var(--muted)]">price</span>
                  <TextInput name="price" type="number" step={market.orderPriceMinTickSize ?? 0.001} defaultValue={quote?.bestAsk ?? quote?.lastTradePrice ?? ""} />
                </label>
                <label className="text-sm">
                  <span className="mb-2 block text-[var(--muted)]">size</span>
                  <TextInput name="size" type="number" step="0.01" defaultValue={market.orderMinSize ?? 5} />
                </label>
                <div className="md:col-span-2">
                  <SubmitButton pendingLabel="提交中...">提交限价单</SubmitButton>
                </div>
              </form>
            ) : (
              <EmptyState title="缺少 tokenId" description="官方 market 返回未带 clobTokenIds，因此这版不展示下单表单。" />
            )}
          </SectionCard>
        </div>

        {quote?.book ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <OrderbookTable title="买盘" levels={quote.book.bids} tone="buy" />
            <OrderbookTable title="卖盘" levels={quote.book.asks} tone="sell" />
          </div>
        ) : (
          <SectionCard title="Orderbook" description="来源: CLOB">
            <EmptyState title="盘口加载失败" description="当前无法获取 orderbook；后续可通过 `/api/quote` 与 WSS 替换服务端轮询。" />
          </SectionCard>
        )}
      </div>
    </ShellPage>
  );
}

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ManualOrderFeedback({
  marketId,
  status,
  detail,
}: {
  marketId: string;
  status: string;
  detail?: string;
}) {
  const tone =
    status === "submitted"
      ? "good"
      : status === "dry_run"
        ? "warn"
        : "danger";

  const message =
    status === "submitted"
      ? `限价单已提交到 Polymarket。订单 ID: ${detail ?? "--"}`
      : status === "dry_run"
        ? `已记录一笔 dry-run 订单。本地订单 ID: ${detail ?? "--"}`
        : status === "rejected"
          ? `订单被拒绝: ${detail ?? "Unknown rejection"}`
          : `下单失败: ${detail ?? "Unknown error"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-lg rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Manual Order</p>
            <h3 className="mt-2 text-xl font-semibold">手工下单结果</h3>
          </div>
          <StatusPill tone={tone}>{status}</StatusPill>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{message}</p>
        <div className="mt-6 flex justify-end">
          <Link
            href={`/markets/${marketId}`}
            className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            关闭
          </Link>
        </div>
      </div>
    </div>
  );
}
