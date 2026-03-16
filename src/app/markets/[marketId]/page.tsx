import { placeManualOrderAction } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { MarketDetailBlock, MarketStats, OrderbookTable, OutcomeList, ShellPage } from "@/components/market-pages";
import { EmptyState, SectionCard, TextInput } from "@/components/ui/primitives";
import { getMarketQuote } from "@/lib/polymarket/clob-public";
import { getMarketById } from "@/lib/polymarket/gamma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  const market = await getMarketById(marketId);
  const tokenIds = market.clobTokenIds ? JSON.parse(market.clobTokenIds) : [];
  const primaryTokenId = tokenIds[0];
  const quote = primaryTokenId ? await getMarketQuote(primaryTokenId).catch(() => null) : null;

  return (
    <ShellPage
      eyebrow="Market Detail"
      title={market.question}
      description="展示官方确认的市场基础字段、outcome / token 映射、盘口与手工下单。实时模块目前通过服务端轮询 route 解耦，WSS market channel 仍保留为后续替换项。"
    >
      <div className="space-y-6">
        <SectionCard title="市场概览" description="来源: Gamma + CLOB">
          <MarketStats market={market} quote={quote ?? undefined} />
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MarketDetailBlock label="market id" value={market.id} />
            <MarketDetailBlock label="condition id" value={market.conditionId ?? "--"} />
            <MarketDetailBlock label="slug" value={market.slug} />
            <MarketDetailBlock label="开始 / 结束" value={`${formatDate(market.startDate)} / ${formatDate(market.endDate)}`} />
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <SectionCard title="Outcome / Token 映射" description="来源: Gamma outcomes + clobTokenIds">
            <OutcomeList outcomesRaw={market.outcomes} tokenIdsRaw={market.clobTokenIds} />
          </SectionCard>

          <SectionCard title="手工限价单" description="按官方语义只提交 limit order，不伪造 market order。">
            {primaryTokenId ? (
              <form action={placeManualOrderAction} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="marketId" value={market.id} />
                <input type="hidden" name="tokenId" value={primaryTokenId} />
                <label className="text-sm">
                  <span className="mb-2 block text-[var(--muted)]">tokenId</span>
                  <TextInput value={primaryTokenId} readOnly />
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

        {quote ? (
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
