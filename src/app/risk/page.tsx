import { cancelAllOrdersAction, updateRiskSettingsAction } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { ShellPage } from "@/components/market-pages";
import { EmptyState, SectionCard, StatCard, StatusPill, TextInput } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { getRiskSettings } from "@/lib/db/settings";
import { humanConfirmationTodos } from "@/lib/mvp-facts";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const [settings, auditLogs] = await Promise.all([
    getRiskSettings(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  return (
    <ShellPage eyebrow="Risk Control" title="风控中心" description="全局风控规则只保存在服务端数据库中。kill switch 打开后，所有新订单都会被阻止。">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="global max exposure" value={settings.globalMaxExposure} hint="来源: local DB risk" />
        <StatCard label="per-market max exposure" value={settings.perMarketMaxExposure} hint="来源: local DB risk" />
        <StatCard label="max order size" value={settings.maxOrderSize} hint="来源: local DB risk" />
        <StatCard label="kill switch" value={<StatusPill tone={settings.emergencyStop ? "danger" : "good"}>{settings.emergencyStop ? "ON" : "OFF"}</StatusPill>} hint="来源: local DB risk" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <SectionCard title="编辑风控参数" description="所有风控动作都会写审计日志。">
          <form action={updateRiskSettingsAction} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">global max exposure</span>
              <TextInput name="globalMaxExposure" type="number" step="0.01" defaultValue={settings.globalMaxExposure} />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">per-market max exposure</span>
              <TextInput name="perMarketMaxExposure" type="number" step="0.01" defaultValue={settings.perMarketMaxExposure} />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max order size</span>
              <TextInput name="maxOrderSize" type="number" step="0.01" defaultValue={settings.maxOrderSize} />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">max daily orders</span>
              <TextInput name="maxDailyOrders" type="number" step="1" defaultValue={settings.maxDailyOrders} />
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm md:col-span-2">
              <input type="checkbox" name="emergencyStop" defaultChecked={settings.emergencyStop} />
              emergency stop / kill switch
            </label>
            <div>
              <SubmitButton pendingLabel="保存中...">保存风控参数</SubmitButton>
            </div>
          </form>
          <form action={cancelAllOrdersAction} className="mt-4">
            <SubmitButton tone="danger" pendingLabel="撤单中...">
              Cancel All Open Orders
            </SubmitButton>
          </form>
        </SectionCard>

        <SectionCard title="审计日志" description="来源: local DB AuditLog">
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <EmptyState title="暂无审计日志" description="保存风控参数或执行撤单后，这里会展示记录。" />
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>{log.action}</span>
                    <span className="text-[var(--muted)]">{formatDate(log.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">
                    {log.entityType}
                    {log.entityId ? ` · ${log.entityId}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="待人工确认项" description="风险边界里最需要谨慎确认的文档点。">
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
