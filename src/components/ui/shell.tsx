"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Gauge, Layers3, ListOrdered, Settings2, ShieldAlert, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/markets", label: "市场发现", icon: Layers3 },
  { href: "/strategies", label: "策略", icon: Zap },
  { href: "/orders", label: "订单与持仓", icon: ListOrdered },
  { href: "/risk", label: "风控", icon: ShieldAlert },
  { href: "/settings", label: "系统设置", icon: Settings2 },
];

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1520px] gap-6 px-4 py-6 md:px-6">
        <aside className="card sticky top-6 hidden h-[calc(100vh-3rem)] w-72 shrink-0 rounded-[28px] p-5 lg:block">
          <div className="grid-pattern rounded-[24px] border border-[var(--line)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Polymarket</p>
                <h1 className="mt-2 text-2xl font-semibold">策略交易系统</h1>
              </div>
              <Activity className="size-9 rounded-full bg-[var(--accent-soft)] p-2 text-[var(--accent)]" />
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              只接官方确认的 Gamma / Data / CLOB 能力。实时行情与策略执行严格分层。
            </p>
          </div>

          <nav className="mt-6 space-y-2">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    active ? "bg-[var(--accent)] text-white" : "pill hover:border-[var(--accent)]",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
