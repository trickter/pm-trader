import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function formatNumber(value: unknown, digits = 3) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }

  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

/** Compact format: 1.4K, 105.2K, 1.4M, 2.3B */
export function formatCompactNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }

  const abs = Math.abs(numeric);
  if (abs >= 1_000_000_000) {
    return `${(numeric / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${(numeric / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(numeric / 1_000).toFixed(1)}K`;
  }
  return formatNumber(value, 2);
}

/** Truncate a hash/id: 0xb486…40c8b */
export function truncateHash(value: string | null | undefined, startLen = 6, endLen = 5) {
  if (!value) return "--";
  if (value.length <= startLen + endLen + 3) return value;
  return `${value.slice(0, startLen)}…${value.slice(-endLen)}`;
}

/** Truncate text to maxLen with ellipsis */
export function truncateText(value: string | null | undefined, maxLen = 40) {
  if (!value) return "--";
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…`;
}

export function formatPercent(value: unknown, digits = 2) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }

  return `${(numeric * 100).toFixed(digits)}%`;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "--";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hashSignal(parts: Array<string | number | null | undefined>) {
  return parts.map((value) => String(value ?? "")).join("::");
}

export function toInputJson<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}
