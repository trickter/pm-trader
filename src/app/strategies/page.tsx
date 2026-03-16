import { createStrategyAction, runEngineNowAction } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { ShellPage } from "@/components/market-pages";
import { EmptyState, SectionCard, StatCard, StatusPill, TextInput } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { humanConfirmationTodos } from "@/lib/mvp-facts";
import { formatDate, truncateHash } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StrategiesPage() {
  const [strategies, signals, runs] = await Promise.all([
    db.strategy.findMany({ orderBy: { updatedAt: "desc" } }),
    db.signal.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.strategyRun.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <ShellPage
      eyebrow="Strategy Engine"
      title="策略管理"
      description="MVP 只实现阈值突破和盘口点差/失衡两类策略。策略计算在服务端执行，浏览器只负责配置和查看结果。"
      actions={
        <form action={runEngineNowAction}>
          <SubmitButton pendingLabel="运行中...">立即跑一次引擎</SubmitButton>
        </form>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="策略总数" value={strategies.length} hint="来源: local DB" />
        <StatCard label="启用中" value={strategies.filter((item) => item.enabled).length} hint="来源: local DB" />
        <StatCard label="Dry-run" value={strategies.filter((item) => item.dryRun).length} hint="来源: local DB" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <SectionCard title="新建策略" description="创建后会落库。dry-run 只记录 signal，不会提交真实订单。">
          <form action={createStrategyAction} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">strategy name</span>
              <TextInput name="name" placeholder="YES breakout on BTC market" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">type</span>
              <select name="type" className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
                <option value="THRESHOLD_BREAKOUT">THRESHOLD_BREAKOUT</option>
                <option value="ORDERBOOK_IMBALANCE">ORDERBOOK_IMBALANCE</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">marketId</span>
              <TextInput name="marketId" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">tokenId</span>
              <TextInput name="tokenId" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">side</span>
              <select name="side" className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">threshold comparator</span>
              <select name="comparator" className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
                <option value="gte">gte</option>
                <option value="lte">lte</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">threshold</span>
              <TextInput name="threshold" type="number" step="0.001" defaultValue="0.55" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max spread</span>
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
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max order size</span>
              <TextInput name="maxOrderSize" type="number" step="0.01" defaultValue="5" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max daily trade count</span>
              <TextInput name="maxDailyTradeCount" type="number" step="1" defaultValue="3" required />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">cooldown seconds</span>
              <TextInput name="cooldownSeconds" type="number" step="1" defaultValue="60" required />
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
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

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
              <EmptyState title="暂无运行记录" description="点击“立即跑一次引擎”后这里会开始积累日志。" />
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
