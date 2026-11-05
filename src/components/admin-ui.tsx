import type { CaseStatus } from "@/generated/prisma/client";
import { STATUS_LABELS } from "@/modules/cases/labels";

const STATUS_COLORS: Record<CaseStatus, string> = {
  FORM_STARTED: "bg-ink-100 text-ink-600",
  FORM_COMPLETED: "bg-ink-100 text-ink-700",
  AWAITING_PAYMENT: "bg-amber-100 text-amber-800",
  PAYMENT_CONFIRMED: "bg-sky-100 text-sky-800",
  AWAITING_REVIEW: "bg-violet-100 text-violet-800",
  DOCUMENT_GENERATED: "bg-brand-100 text-brand-700",
  DELIVERED: "bg-brand-500 text-ink-950",
  REJECTED_NO_TEMPLATE: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "red" | "amber" | "violet" }) {
  const tones = {
    neutral: "bg-ink-100 text-ink-700",
    green: "bg-brand-100 text-brand-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    violet: "bg-violet-100 text-violet-800",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {title && <h2 className="mb-4 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export const fmtDate = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(d) : "—";

export const eur = (c: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(c / 100);
