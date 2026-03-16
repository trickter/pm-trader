import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card rounded-[28px] p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="card rounded-[24px] p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
      <p className="mt-3 text-sm text-[var(--muted)]">{hint}</p>
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  const tones = {
    neutral: "border-[var(--line-strong)] bg-[var(--surface-strong)] text-[var(--fg)]",
    good: "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]",
    warn: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
    danger: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
  };

  return <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}

export function ActionButton({
  children,
  tone = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "danger" | "ghost";
}) {
  const tones = {
    default: "bg-[var(--accent)] text-white hover:opacity-90",
    danger: "bg-[var(--danger)] text-white hover:opacity-90",
    ghost: "pill hover:border-[var(--accent)]",
  };

  return (
    <button
      className={cn("rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60", tones[tone], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm",
        props.className,
      )}
    />
  );
}
