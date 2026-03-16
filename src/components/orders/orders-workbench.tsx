"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMemo, useState, useCallback } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { PositionsTable } from "./positions-table";
import { OpenOrdersTable } from "./open-orders-table";
import { HistoryTable } from "./history-table";

const TABS = [
  { key: "positions", label: "Positions" },
  { key: "open-orders", label: "Open Orders" },
  { key: "history", label: "History" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export type PositionRow = {
  id: string;
  title: string;
  conditionId: string;
  asset: string;
  size: string;
  currentValue: string;
  outcome?: string;
};

export type OpenOrderRow = {
  id: string;
  source: "clob" | "local";
  market: string;
  side: string;
  price: string;
  size: string;
  status: string;
  createdAt?: string;
  dryRun?: boolean;
};

export type HistoryRow = {
  id: string;
  source: "clob-trade" | "local-order" | "local-fill";
  market: string;
  side: string;
  price: string;
  size: string;
  status?: string;
  createdAt?: string;
  traderSide?: string;
  fillSource?: string;
};

interface OrdersWorkbenchProps {
  positions: PositionRow[];
  openOrders: OpenOrderRow[];
  history: HistoryRow[];
  tradingConfigured: boolean;
}

export function OrdersWorkbench({
  positions,
  openOrders,
  history,
  tradingConfigured,
}: OrdersWorkbenchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTab = (searchParams.get("tab") as TabKey) || "positions";
  const [query, setQuery] = useState("");

  const setTab = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const filteredPositions = useMemo(() => {
    if (!query) return positions;
    const q = query.toLowerCase();
    return positions.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.asset.toLowerCase().includes(q) ||
        p.conditionId.toLowerCase().includes(q),
    );
  }, [positions, query]);

  const filteredOpenOrders = useMemo(() => {
    if (!query) return openOrders;
    const q = query.toLowerCase();
    return openOrders.filter(
      (o) =>
        o.market.toLowerCase().includes(q) ||
        o.side.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q),
    );
  }, [openOrders, query]);

  const filteredHistory = useMemo(() => {
    if (!query) return history;
    const q = query.toLowerCase();
    return history.filter(
      (h) =>
        h.market.toLowerCase().includes(q) ||
        h.side.toLowerCase().includes(q) ||
        (h.status?.toLowerCase().includes(q) ?? false),
    );
  }, [history, query]);

  return (
    <div className="space-y-4">
      {/* Tab bar + toolbar */}
      <div className="card rounded-[24px] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-2xl bg-[var(--surface-strong)] p-1">
            {TABS.map((tab) => {
              const isActive = currentTab === tab.key;
              const count =
                tab.key === "positions"
                  ? positions.length
                  : tab.key === "open-orders"
                    ? openOrders.length
                    : history.length;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTab(tab.key)}
                  className={cn(
                    "relative rounded-xl px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-[var(--surface)] text-[var(--fg)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--fg)]",
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "ml-1.5 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                        isActive
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "bg-[var(--surface-strong)] text-[var(--muted)]",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative max-w-xs flex-1 sm:max-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by market, side…"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {!tradingConfigured && (
          <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] px-4 py-2.5 text-xs text-[var(--muted)]">
            Trading credentials not configured — CLOB data shows empty. Local dry-run orders and Data API positions are still available.
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="card min-h-[320px] rounded-[24px]">
        {currentTab === "positions" && <PositionsTable rows={filteredPositions} />}
        {currentTab === "open-orders" && <OpenOrdersTable rows={filteredOpenOrders} />}
        {currentTab === "history" && <HistoryTable rows={filteredHistory} />}
      </div>
    </div>
  );
}
