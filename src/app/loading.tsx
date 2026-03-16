export default function Loading() {
  return (
    <div className="mx-auto max-w-[1520px] px-4 py-10 md:px-6">
      <div className="card animate-pulse rounded-[28px] p-8">
        <div className="h-4 w-32 rounded bg-[var(--surface-strong)]" />
        <div className="mt-4 h-9 w-72 rounded bg-[var(--surface-strong)]" />
        <div className="mt-4 h-20 rounded bg-[var(--surface-strong)]" />
      </div>
    </div>
  );
}
