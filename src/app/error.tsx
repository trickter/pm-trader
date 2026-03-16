"use client";

import { ActionButton } from "@/components/ui/primitives";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[var(--bg)] p-8">
        <div className="card mx-auto max-w-2xl rounded-[28px] p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--danger)]">Error</p>
          <h1 className="mt-3 text-3xl font-semibold">页面加载失败</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">{error.message}</p>
          <div className="mt-6">
            <ActionButton onClick={reset}>重试</ActionButton>
          </div>
        </div>
      </body>
    </html>
  );
}
