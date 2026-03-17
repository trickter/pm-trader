import { createStrategyAction, runEngineNowAction, runMarketScanAction } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { ShellPage } from "@/components/market-pages";
import { EmptyState, SectionCard, StatCard, StatusPill, TextInput } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { humanConfirmationTodos } from "@/lib/mvp-facts";
import { formatDate, truncateHash } from "@/lib/utils";

export const dynamic = "force-dynamic";

const selectClass = "w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5";

export default async function StrategiesPage() {
  const [strategies, signals, runs, recentSuitability] = await Promise.all([
    db.strategy.findMany({ orderBy: { updatedAt: "desc" } }),
    db.signal.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.strategyRun.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.marketSuitability.findMany({ orderBy: { capturedAt: "desc" }, take: 10 }),
  ]);

  const rangeStrategies = strategies.filter((s) => s.type === "TWO_SIDED_RANGE_QUOTING");

  return (
    <ShellPage
      eyebrow="Strategy Engine"
      title="策略管理"
      description="支持阈值突破、盘口失衡、双边区间挂单三类策略。策略计算在服务端执行，浏览器只负责配置和查看结果。"
      actions={
        <form action={runEngineNowAction}>
          <SubmitButton pendingLabel="运行中...">立即跑一次引擎</SubmitButton>
        </form>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="策略总数" value={strategies.length} hint="来源: local DB" />
        <StatCard label="启用中" value={strategies.filter((item) => item.enabled).length} hint="来源: local DB" />
        <StatCard label="Dry-run" value={strategies.filter((item) => item.dryRun).length} hint="来源: local DB" />
        <StatCard label="区间挂单策略" value={rangeStrategies.length} hint="TWO_SIDED_RANGE_QUOTING" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <SectionCard title="新建策略" description="创建后会落库。dry-run 只记录 signal，不会提交真实订单。">
          <form action={createStrategyAction} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">strategy name</span>
              <TextInput name="name" placeholder="Range quoting on mid-prob market" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">type</span>
              <select name="type" className={selectClass}>
                <option value="TWO_SIDED_RANGE_QUOTING">TWO_SIDED_RANGE_QUOTING</option>
                <option value="THRESHOLD_BREAKOUT">THRESHOLD_BREAKOUT</option>
                <option value="ORDERBOOK_IMBALANCE">ORDERBOOK_IMBALANCE</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">marketId</span>
              <TextInput name="marketId" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">tokenId (or &quot;auto&quot; for two-sided)</span>
              <TextInput name="tokenId" defaultValue="auto" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">side</span>
              <select name="side" className={selectClass}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">threshold comparator</span>
              <select name="comparator" className={selectClass}>
                <option value="gte">gte</option>
                <option value="lte">lte</option>
              </select>
            </label>

            {/* THRESHOLD_BREAKOUT params */}
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">threshold</span>
              <TextInput name="threshold" type="number" step="0.001" defaultValue="0.55" />
            </label>

            {/* ORDERBOOK_IMBALANCE params */}
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max spread (imbalance)</span>
              <TextInput name="maxSpread" type="number" step="0.001" defaultValue="0.02" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">min top depth</span>
              <TextInput name="minTopDepth" type="number" step="1" defaultValue="50" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">imbalance ratio</span>
              <TextInput name="imbalanceRatio" type="number" step="0.01" defaultValue="0.65" />
            </label>

            {/* TWO_SIDED_RANGE_QUOTING params */}
            <div className="md:col-span-2 mt-2 border-t border-[var(--line)] pt-3">
              <p className="text-xs font-medium text-[var(--muted)] mb-3">区间挂单参数 (TWO_SIDED_RANGE_QUOTING)</p>
            </div>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">entry low</span>
              <TextInput name="entryLow" type="number" step="0.01" defaultValue="0.36" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">entry high</span>
              <TextInput name="entryHigh" type="number" step="0.01" defaultValue="0.42" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">exit low</span>
              <TextInput name="exitLow" type="number" step="0.01" defaultValue="0.58" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">exit high</span>
              <TextInput name="exitHigh" type="number" step="0.01" defaultValue="0.64" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">order size</span>
              <TextInput name="orderSize" type="number" step="0.01" defaultValue="5" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max inventory per side</span>
              <TextInput name="maxInventoryPerSide" type="number" step="1" defaultValue="25" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max inventory per market</span>
              <TextInput name="maxInventoryPerMarket" type="number" step="1" defaultValue="40" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max open orders per side</span>
              <TextInput name="maxOpenOrdersPerSide" type="number" step="1" defaultValue="2" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">min liquidity (USD)</span>
              <TextInput name="minLiquidity" type="number" step="100" defaultValue="10000" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">min volume 24h (USD)</span>
              <TextInput name="minVolume24h" type="number" step="100" defaultValue="1000" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">min book depth (USD)</span>
              <TextInput name="minBookDepth" type="number" step="10" defaultValue="200" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max spread (range)</span>
              <TextInput name="rangeMaxSpread" type="number" step="0.01" defaultValue="0.08" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">min time to expiry (minutes)</span>
              <TextInput name="minTimeToExpiryMinutes" type="number" step="60" defaultValue="4320" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">quote refresh (seconds)</span>
              <TextInput name="quoteRefreshSeconds" type="number" step="5" defaultValue="60" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">stale quote (seconds)</span>
              <TextInput name="staleQuoteSeconds" type="number" step="10" defaultValue="300" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">scan interval (seconds)</span>
              <TextInput name="scanIntervalSeconds" type="number" step="10" defaultValue="300" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">trend filter threshold</span>
              <TextInput name="trendFilterThreshold" type="number" step="0.01" defaultValue="0.10" />
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
              <input type="checkbox" name="trendFilterEnabled" defaultChecked />
              trend filter
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
              <input type="checkbox" name="allowBothSidesInventory" defaultChecked />
              allow both sides inventory
            </label>

            {/* Common params */}
            <div className="md:col-span-2 mt-2 border-t border-[var(--line)] pt-3">
              <p className="text-xs font-medium text-[var(--muted)] mb-3">通用参数</p>
            </div>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max order size</span>
              <TextInput name="maxOrderSize" type="number" step="0.01" defaultValue="5" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max daily trade count</span>
              <TextInput name="maxDailyTradeCount" type="number" step="1" defaultValue="10" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">cooldown seconds</span>
              <TextInput name="cooldownSeconds" type="number" step="1" defaultValue="30" required />
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
              <input type="checkbox" name="pauseOnStaleData" defaultChecked />
              pause on stale data
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
              <input type="checkbox" name="cancelOpenOrdersOnStaleData" />
              cancel open orders on stale data
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
              <input type="checkbox" name="dryRun" defaultChecked />
              dry-run
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
              <input type="checkbox" name="enabled" defaultChecked />
              enabled
            </label>
            <div className="md:col-span-2">
              <SubmitButton pendingLabel="保存中...">保存策略</SubmitButton>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="策略列表" description="来源: local DB">
          <div className="space-y-3">
            {strategies.length === 0 ? (
              <EmptyState title="暂无策略" description="先从左侧表单创建一个策略。" />
            ) : (
              strategies.map((strategy) => (
                <div key={strategy.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{strategy.name}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        {strategy.type} · {strategy.side} · <span className="font-mono" title={strategy.marketId}>{truncateHash(strategy.marketId, 8, 6)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <StatusPill tone={strategy.enabled ? "good" : "warn"}>{strategy.enabled ? "enabled" : "disabled"}</StatusPill>
                      <StatusPill tone={strategy.dryRun ? "warn" : "danger"}>{strategy.dryRun ? "dry-run" : "live"}</StatusPill>
                      {strategy.systemPausedAt ? <StatusPill tone="danger">system-paused</StatusPill> : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    stale guard: {strategy.pauseOnStaleData ? "pause" : "ignore"} / {strategy.cancelOpenOrdersOnStaleData ? "cancel open orders" : "keep orders"}
                  </p>
                  {strategy.systemPausedAt ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      paused because {strategy.systemPauseReason ?? "stale data"} at {formatDate(strategy.systemPausedAt)}
                    </p>
                  ) : null}
                  {strategy.type === "TWO_SIDED_RANGE_QUOTING" && (
                    <div className="mt-2">
                      <form action={runMarketScanAction} className="inline">
                        <input type="hidden" name="strategyId" value={strategy.id} />
                        <SubmitButton pendingLabel="扫描中...">扫描候选市场</SubmitButton>
                      </form>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      {/* Market suitability results */}
      {recentSuitability.length > 0 && (
        <SectionCard title="候选市场评分 (最近)" description="来源: MarketSuitability 快照">
          <div className="space-y-3">
            {recentSuitability.map((s) => {
              const snap = s.snapshot as Record<string, unknown> | null;
              return (
                <div key={s.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs" title={s.marketId}>{truncateHash(s.marketId, 8, 6)}</span>
                    <div className="flex gap-2">
                      <StatusPill tone={s.qualified ? "good" : "warn"}>score: {s.score}</StatusPill>
                      <StatusPill tone={s.qualified ? "good" : "danger"}>{s.qualified ? "qualified" : "rejected"}</StatusPill>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)] truncate">{snap?.question ? String(snap.question) : s.reason}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    price={scorePart("priceRange", s.priceRangeScore)} liq={scorePart("liq", s.liquidityScore)} vol={scorePart("vol", s.volumeScore)} depth={scorePart("depth", s.bookDepthScore)} spread={scorePart("spread", s.spreadScore)} expiry={scorePart("expiry", s.timeToExpiry)}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="最近信号" description="来源: local DB">
          <div className="space-y-3">
            {signals.length === 0 ? (
              <EmptyState title="暂无信号" description="启用策略后运行服务端引擎。" />
            ) : (
              signals.map((signal) => (
                <div key={signal.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{signal.signalType}</span>
                    <StatusPill tone={signal.executed ? "good" : "warn"}>{signal.executed ? "executed" : "logged"}</StatusPill>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">{signal.reason}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="最近引擎运行" description="来源: local DB StrategyRun">
          <div className="space-y-3">
            {runs.length === 0 ? (
              <EmptyState title="暂无运行记录" description={"点击\"立即跑一次引擎\"后这里会开始积累日志。"} />
            ) : (
              runs.map((run) => (
                <div key={run.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{run.status}</span>
                    <span className="text-[var(--muted)]">{formatDate(run.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">{run.summary ?? "--"}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="待人工确认项" description="这些地方文档边界还不够硬，所以当前只做标记不硬写。">
        <div className="space-y-2 text-sm text-[var(--muted)]">
          {humanConfirmationTodos.map((item) => (
            <div key={item} className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-3">
              {item}
            </div>
          ))}
        </div>
      </SectionCard>
    </ShellPage>
  );
}

function scorePart(label: string, value: number) {
  return `${label}:${value}`;
}
