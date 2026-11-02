import Link from "next/link";
import type { ReactNode } from "react";

/* ─── Button ─────────────────────────────────────────────────────────────── */
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-accent text-accentfg hover:opacity-90 focus-visible:outline-accent",
    secondary:
      "bg-surface2 text-fg border border-border hover:bg-surface",
    danger: "bg-danger text-white hover:opacity-90",
    ghost: "text-muted hover:text-fg hover:bg-surface2",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

/* ─── Card ───────────────────────────────────────────────────────────────── */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-6 ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── PageHeader ─────────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

/* ─── StatCard ───────────────────────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "info" | "warning";
  hint?: string;
}) {
  const tones = {
    neutral: "text-fg",
    positive: "text-accent",
    negative: "text-danger",
    info: "text-info",
    warning: "text-warning",
  } as const;
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${tones[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

/* ─── Form primitives ────────────────────────────────────────────────────── */
export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-fg"
    >
      {children}
    </label>
  );
}

const fieldClasses =
  "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClasses} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${fieldClasses} ${props.className ?? ""}`} />
  );
}

/* ─── Badge ──────────────────────────────────────────────────────────────── */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "info" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-surface2 text-muted border-border",
    accent: "bg-accentsoft text-accent border-accent/30",
    info: "bg-infosoft text-info border-info/30",
    warning: "bg-warningsoft text-warning border-warning/30",
    danger: "bg-dangersoft text-danger border-danger/30",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ─── EmptyState ─────────────────────────────────────────────────────────── */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/* ─── PlannedModule — honest roadmap state for not-yet-built modules ─────── */
export function PlannedModule({
  title,
  phase,
  summary,
  capabilities,
}: {
  title: string;
  phase: string;
  summary: string;
  capabilities: string[];
}) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Scheduled in the approved build roadmap"
        actions={<Badge tone="info">{phase}</Badge>}
      />
      <Card>
        <p className="text-sm leading-relaxed text-muted">{summary}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {capabilities.map((c) => (
            <li key={c} className="flex items-start gap-2">
              <span aria-hidden className="mt-1 text-accent">✓</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-border pt-4 text-xs text-muted">
          WealthOS never shows fabricated numbers. This page becomes live when
          its phase lands — until then it stays honestly empty rather than
          pretending.
        </p>
      </Card>
    </div>
  );
}

export function BackToSignIn() {
  return (
    <Link href="/signin" className="text-sm font-medium text-accent hover:underline">
      Back to sign in
    </Link>
  );
}
