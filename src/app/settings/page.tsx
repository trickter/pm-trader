import { updateRuntimeSettingsAction } from "@/app/actions/settings";
import { SubmitButton } from "@/components/forms/submit-button";
import { ShellPage } from "@/components/market-pages";
import { SectionCard, StatCard, StatusPill, TextInput, EmptyState } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { getRuntimeSettings } from "@/lib/db/settings";
import { env } from "@/lib/env";
import { humanConfirmationTodos, polymarketFacts } from "@/lib/mvp-facts";
import { getTradingScope, isTradingConfigured } from "@/lib/polymarket/server-config";
import { getTradingReadiness } from "@/lib/trading/readiness";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [runtime, auditLogs, readiness] = await Promise.all([
    getRuntimeSettings(),
    db.auditLog.findMany({
      where: { entityType: "SystemSetting" },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    getTradingReadiness(),
  ]);

  const tradingScope = getTradingScope();
  const healthDetails = readiness.healthDetails as Record<string, unknown>;

  return (
    <ShellPage eyebrow="Server Runtime" title="系统设置" description="所有密钥都只存在服务端环境变量中，前端只展示是否已配置和适用范围，不回显敏感值。">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="api host" value={runtime.apiHost} hint="from env var (read-only)" />
        <StatCard label="chain id" value={runtime.chainId} hint="from env var (read-only)" />
        <StatCard label="wallet mode" value={runtime.walletMode} hint="from env signature type (read-only)" />
        <StatCard label="trading creds" value={<StatusPill tone={isTradingConfigured() ? "good" : "warn"}>{isTradingConfigured() ? "configured" : "missing"}</StatusPill>} hint="server env only" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <SectionCard title="运行时参数" description="这里只保存非敏感运行时设置；私钥和 API key 不会进入数据库。">
          <form action={updateRuntimeSettingsAction} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">api host</span>
              <TextInput name="apiHost" defaultValue={runtime.apiHost} disabled />
              <span className="mt-1 block text-xs text-[var(--muted)]">Controlled by environment variable. Read-only.</span>
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">chain id</span>
              <TextInput name="chainId" type="number" defaultValue={runtime.chainId} disabled />
              <span className="mt-1 block text-xs text-[var(--muted)]">Controlled by environment variable. Read-only.</span>
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm md:col-span-2">
              <input type="checkbox" name="defaultDryRun" defaultChecked={runtime.defaultDryRun} />
              default dry-run
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max market data staleness (ms)</span>
              <TextInput name="maxMarketDataStalenessMs" type="number" step="100" defaultValue={runtime.maxMarketDataStalenessMs} />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max user state staleness (ms)</span>
              <TextInput name="maxUserStateStalenessMs" type="number" step="100" defaultValue={runtime.maxUserStateStalenessMs} />
            </label>
            <div>
              <SubmitButton pendingLabel="保存中...">保存设置</SubmitButton>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="密钥边界与适用范围" description="来源: server env + official auth scope">
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <p className="font-medium">signature mode</p>
              <p className="mt-2 text-[var(--muted)]">
                当前支持 `EOA(0)`、`POLY_PROXY(1)` 与 `POLY_GNOSIS_SAFE(2)`。当前配置值: signatureType {tradingScope.signatureType}, walletMode {tradingScope.walletMode}, chainId {tradingScope.chainId}。
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <p className="font-medium">server-only secrets</p>
              <p className="mt-2 text-[var(--muted)]">
                `POLYMARKET_PRIVATE_KEY`: {env.POLYMARKET_PRIVATE_KEY ? "configured" : "missing"} · `POLYMARKET_TRADER_ADDRESS`:{" "}
                {env.POLYMARKET_TRADER_ADDRESS ? "configured" : "missing"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <p className="font-medium">auth diagnostics</p>
              <p className="mt-2 text-[var(--muted)]">
                signer: {String(readiness.healthDetails.signerAddress ?? "unknown")}
              </p>
              <p className="mt-2 text-[var(--muted)]">
                funder: {String(readiness.healthDetails.funderAddress ?? "unknown")}
              </p>
              <p className="mt-2 text-[var(--muted)]">
                auth status: {String(healthDetails.authOk ? "ok" : "failed")}
              </p>
              <p className="mt-2 break-words text-[var(--muted)]">
                auth error: {String(healthDetails.authError ?? "none")}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="交易主链路健康" description="WebSocket 主链路 + reconcile gate">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <p className="font-medium">market data</p>
              <p className="mt-2">
                <StatusPill tone={readiness.marketFresh ? "good" : "danger"}>{readiness.marketFresh ? "fresh" : "stale"}</StatusPill>
              </p>
              <p className="mt-2 text-[var(--muted)]">threshold: {runtime.maxMarketDataStalenessMs}ms</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <p className="font-medium">user state</p>
              <p className="mt-2">
                <StatusPill tone={readiness.userFresh ? "good" : "danger"}>{readiness.userFresh ? "fresh" : "stale"}</StatusPill>
              </p>
              <p className="mt-2 text-[var(--muted)]">threshold: {runtime.maxUserStateStalenessMs}ms</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2">
              <p className="font-medium">trading readiness</p>
              <p className="mt-2">
                <StatusPill tone={readiness.ready ? "good" : "danger"}>{readiness.ready ? "ready" : "blocked"}</StatusPill>
              </p>
              <p className="mt-2 text-[var(--muted)]">reason: {readiness.blockReason ?? "none"}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <p className="font-medium">last market message</p>
              <p className="mt-2 text-[var(--muted)]">{formatDate(readiness.lastMarketMessageAt)}</p>
              <p className="mt-2 text-[var(--muted)]">last market reconcile: {formatDate(readiness.lastMarketReconciledAt)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <p className="font-medium">last user message</p>
              <p className="mt-2 text-[var(--muted)]">{formatDate(readiness.lastUserMessageAt)}</p>
              <p className="mt-2 text-[var(--muted)]">last user reconcile: {formatDate(readiness.lastUserReconciledAt)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2">
              <p className="font-medium">reconcile diagnostics</p>
              <p className="mt-2 text-[var(--muted)]">status: {String(healthDetails.lastReconcileStatus ?? "unknown")}</p>
              <p className="mt-2 text-[var(--muted)]">reason: {String(healthDetails.lastReconcileReason ?? "none")}</p>
              <p className="mt-2 text-[var(--muted)]">attempt: {String(healthDetails.reconcileAttempt ?? 0)}</p>
              <p className="mt-2 text-[var(--muted)]">failure count: {String(healthDetails.reconcileFailureCount ?? 0)}</p>
              <p className="mt-2 break-words text-[var(--muted)]">last error: {String(healthDetails.lastReconcileError ?? "none")}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="事实清单" description="只列这版确实采用或显式保留 TODO 的官方能力。">
          <div className="space-y-3 text-sm">
            {polymarketFacts.map((fact) => (
              <div key={fact.capability} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{fact.capability}</span>
                  <StatusPill tone={fact.adoptedInMvp ? "good" : "warn"}>{fact.adoptedInMvp ? "adopted" : "todo"}</StatusPill>
                </div>
                <p className="mt-2 text-[var(--muted)]">{fact.usage}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="最近设置审计" description="来源: local DB AuditLog">
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <EmptyState title="暂无设置日志" description="保存系统设置后这里会出现记录。" />
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>{log.action}</span>
                    <span className="text-[var(--muted)]">{formatDate(log.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="待人工确认项" description="这些项目在官方边界上仍需要补一轮人工确认。">
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
