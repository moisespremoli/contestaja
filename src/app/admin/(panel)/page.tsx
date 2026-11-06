import Link from "next/link";
import { eur, PageTitle, Panel, StatusBadge, fmtDate } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { STATUS_LABELS } from "@/modules/cases/labels";
import type { CaseStatus } from "@/generated/prisma/client";

export default async function Dashboard() {
  // Processos concluídos com cupão de teste não contam para as métricas comerciais.
  const real = { NOT: { payments: { some: { status: "CONFIRMED" as const, coupon: { isTest: true } } } } };
  const realPayment = { status: "CONFIRMED" as const, NOT: { coupon: { isTest: true } } };
  const [total, byStatus, payments, revenue, byCategory, docs, recent, testActive, testCases, testCouponsActive] = await Promise.all([
    db.case.count({ where: real }),
    db.case.groupBy({ by: ["status"], where: real, _count: true }),
    db.payment.count({ where: realPayment }),
    db.payment.aggregate({ where: realPayment, _sum: { amountCents: true } }),
    db.case.groupBy({ by: ["categoryId"], _count: true }),
    db.generatedDocument.count(),
    db.case.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.template.count({ where: { isTest: true, status: "ACTIVE" } }),
    db.case.count({ where: { payments: { some: { status: "CONFIRMED", coupon: { isTest: true } } } } }),
    db.coupon.count({ where: { isTest: true, active: true } }),
  ]);
  const categories = await db.infractionCategory.findMany();
  const count = (s: CaseStatus) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const pending = count("AWAITING_REVIEW") + count("PAYMENT_CONFIRMED") + count("AWAITING_PAYMENT");
  const conversion = total ? Math.round((payments / total) * 1000) / 10 : 0;

  const kpis = [
    ["Total de pedidos", total],
    ["Pagamentos confirmados", payments],
    ["Receita total", eur(revenue._sum.amountCents ?? 0)],
    ["Documentos gerados", docs],
    ["Processos pendentes", pending],
    ["Taxa de conversão", `${conversion}%`],
  ] as const;

  return (
    <>
      <PageTitle title="Dashboard" />
      {testActive > 0 && (
        <p className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Atenção: existem {testActive} minuta(s) de TESTE ativas. Desative-as antes de abrir o serviço ao público.
        </p>
      )}
      {testCouponsActive > 0 && (
        <p className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Existem {testCouponsActive} cupão(ões) de TESTE ativos (ex.: CONTESTATESTE). Desative-os ou limite as utilizações em{" "}
          <Link href="/admin/cupoes" className="underline">Cupões</Link> antes da abertura ao público.
        </p>
      )}
      {testCases > 0 && <p className="mb-4 text-xs text-ink-500">{testCases} processo(s) concluído(s) com cupão de teste excluído(s) destas métricas.</p>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="text-xs text-ink-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Pedidos por estado">
          <ul className="space-y-2 text-sm">
            {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => (
              <li key={s} className="flex justify-between">
                <span className="text-ink-600">{STATUS_LABELS[s]}</span>
                <span className="font-medium">{count(s)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Pedidos por categoria">
          <ul className="space-y-2 text-sm">
            {categories.map((c) => (
              <li key={c.id} className="flex justify-between">
                <span className="text-ink-600">{c.name}</span>
                <span className="font-medium">{byCategory.find((b) => b.categoryId === c.id)?._count ?? 0}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Pedidos recentes">
          <ul className="divide-y divide-ink-100 text-sm">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/admin/processos/${c.id}`} className="min-w-0">
                  <span className="block font-mono text-xs">{c.reference}</span>
                  <span className="block truncate text-ink-500">{c.displayName} · {fmtDate(c.createdAt)}</span>
                </Link>
                <StatusBadge status={c.status} />
              </li>
            ))}
            {recent.length === 0 && <li className="py-2 text-ink-400">Sem pedidos.</li>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
