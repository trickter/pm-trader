"use client";

import { cn, truncateHash } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

/** Copy button that shows a check icon briefly after copying */
export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg p-1 text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--fg)]",
        className,
      )}
      title="Copy to clipboard"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** Display a hash/id with truncation, tooltip, and optional copy button */
export function CopyableId({
  value,
  startLen = 6,
  endLen = 5,
  className,
}: {
  value: string | null | undefined;
  startLen?: number;
  endLen?: number;
  className?: string;
}) {
  if (!value) return <span className="text-[var(--muted)]">--</span>;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="font-mono text-xs" title={value}>
        {truncateHash(value, startLen, endLen)}
      </span>
      <CopyButton value={value} />
    </span>
  );
}

/** A key-value row for metadata display */
export function MetaRow({
  label,
  children,
  className,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5", className)}>
      <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</span>
      <span className={cn("min-w-0 text-right text-sm", mono && "font-mono text-xs")}>{children}</span>
    </div>
  );
}

/** Grid of key-value pairs for detail pages */
export function KeyValueGrid({
  items,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-h-[72px] flex-col justify-between rounded-2xl border border-[var(--line)] px-4 py-3"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{item.label}</p>
          <div className="mt-2 min-w-0 text-sm">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
