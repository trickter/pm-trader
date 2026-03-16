import { updateRuntimeSettingsAction } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { ShellPage } from "@/components/market-pages";
import { SectionCard, StatCard, StatusPill, TextInput, EmptyState } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { getRuntimeSettings } from "@/lib/db/settings";
import { env } from "@/lib/env";
import { humanConfirmationTodos, polymarketFacts } from "@/lib/mvp-facts";
import { getTradingScope, isTradingConfigured } from "@/lib/polymarket/server-config";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [runtime, auditLogs] = await Promise.all([
    getRuntimeSettings(),
    db.auditLog.findMany({
      where: { entityType: "SystemSetting" },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const tradingScope = getTradingScope();

  return (
    <ShellPage eyebrow="Server Runtime" title="系统设置" description="所有密钥都只存在服务端环境变量中，前端只展示是否已配置和适用范围，不回显敏感值。">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="api host" value={runtime.apiHost} hint="local DB runtime" />
        <StatCard label="chain id" value={runtime.chainId} hint="local DB runtime" />
        <StatCard label="wallet mode" value={runtime.walletMode} hint="MVP 只支持 EOA" />
        <StatCard label="trading creds" value={<StatusPill tone={isTradingConfigured() ? "good" : "warn"}>{isTradingConfigured() ? "configured" : "missing"}</StatusPill>} hint="server env only" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <SectionCard title="运行时参数" description="这里只保存非敏感运行时设置；私钥和 API key 不会进入数据库。">
          <form action={updateRuntimeSettingsAction} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">api host</span>
              <TextInput name="apiHost" defaultValue={runtime.apiHost} />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">chain id</span>
              <TextInput name="chainId" type="number" defaultValue={runtime.chainId} />
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm md:col-span-2">
              <input type="checkbox" name="defaultDryRun" defaultChecked={runtime.defaultDryRun} />
              default dry-run
            </label>
            <div>
              <SubmitButton pendingLabel="保存中...">保存设置</SubmitButton>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="密钥边界与适用范围" description="来源: server env + official auth scope">
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <p className="font-medium">EOA only</p>
              <p className="mt-2 text-[var(--muted)]">
                这版只实现官方已确认的 EOA 签名类型，当前配置值: signatureType {tradingScope.signatureType}, chainId {tradingScope.chainId}。
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <p className="font-medium">server-only secrets</p>
              <p className="mt-2 text-[var(--muted)]">
                `POLYMARKET_PRIVATE_KEY`: {env.POLYMARKET_PRIVATE_KEY ? "configured" : "missing"} · `POLYMARKET_TRADER_ADDRESS`:{" "}
                {env.POLYMARKET_TRADER_ADDRESS ? "configured" : "missing"}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
