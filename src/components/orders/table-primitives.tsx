import { cn } from "@/lib/utils";

/** Reusable table wrapper with horizontal scroll */
export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

/** Table header row */
export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-[var(--muted)]">
        {children}
      </tr>
    </thead>
  );
}

/** Table header cell */
export function Th({
  children,
  className,
  align,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-3 font-medium",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Table data cell */
export function Td({
  children,
  className,
  align,
  mono,
  muted,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-4 py-3",
        align === "right" && "text-right",
        align === "center" && "text-center",
        mono && "font-mono text-xs",
        muted && "text-[var(--muted)]",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Side badge (BUY/SELL or Yes/No) */
export function SideBadge({ side }: { side: string }) {
  const isBuy = side.toUpperCase() === "BUY" || side.toLowerCase() === "yes";
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
        isBuy
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "bg-[var(--danger-soft)] text-[var(--danger)]",
      )}
    >
      {side}
    </span>
  );
}

/** Source badge for data provenance */
export function SourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex rounded-md bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
      {source}
    </span>
  );
}

/** Status badge with appropriate color */
export function OrderStatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();
  const tone =
    upper === "FILLED" || upper === "SUBMITTED" || upper === "LIVE" || upper === "MATCHED"
      ? "good"
      : upper === "REJECTED" || upper === "CANCELLED"
        ? "danger"
        : upper === "PENDING" || upper === "PARTIALLY_FILLED"
          ? "warn"
          : "neutral";

  const tones = {
    good: "bg-[var(--accent-soft)] text-[var(--accent)]",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
    warn: "bg-[var(--warning-soft)] text-[var(--warning)]",
    neutral: "bg-[var(--surface-strong)] text-[var(--muted)]",
  };

  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {status}
    </span>
  );
}

/** Empty state for tables */
export function TableEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-medium text-[var(--fg)]">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}
