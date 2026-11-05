import Link from "next/link";
import { Badge, PageTitle, StatusBadge, fmtDate } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { STATUS_LABELS } from "@/modules/cases/labels";
import type { CaseStatus, Prisma } from "@/generated/prisma/client";

const PAGE = 25;

export default async function Processos({ searchParams }: PageProps<"/admin/processos">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.estado === "string" && sp.estado in STATUS_LABELS ? (sp.estado as CaseStatus) : undefined;
  const page = Math.max(1, Number(sp.p ?? 1) || 1);

  const where: Prisma.CaseWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: {
        category: true,
        templateVersion: { include: { template: true } },
        payments: { where: { status: "CONFIRMED" }, take: 1 },
        documents: { take: 1, orderBy: { createdAt: "desc" } },
      },
    }),
    db.case.count({ where }),
  ]);

  return (
    <>
      <PageTitle title="Processos" />
      <form className="mb-4 flex flex-wrap gap-3">
        <input name="q" defaultValue={q} placeholder="Referência, nome ou email" className="input max-w-xs" />
        <select name="estado" defaultValue={status ?? ""} className="input max-w-xs">
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="btn btn-primary">Filtrar</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-ink-100 text-left text-xs text-ink-500">
            <tr>
              {["Processo", "Cliente", "Tipo", "Criado", "Pagamento", "Documento", "Minuta", "Estado"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-ink-50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/admin/processos/${c.id}`} className="underline">{c.reference}</Link>
                </td>
                <td className="px-4 py-3">{c.displayName}</td>
                <td className="px-4 py-3">
                  {c.category.name}
                  <span className="block text-xs text-ink-400">{c.applicantType === "SINGULAR" ? "Pessoa singular" : "Pessoa coletiva"}</span>
                </td>
                <td className="px-4 py-3 text-ink-500">{fmtDate(c.createdAt)}</td>
                <td className="px-4 py-3">{c.payments.length ? <Badge tone="green">Confirmado</Badge> : <Badge>—</Badge>}</td>
                <td className="px-4 py-3">{c.documents.length ? <Badge tone="green">Gerado</Badge> : <Badge>—</Badge>}</td>
                <td className="px-4 py-3 text-xs">{c.templateVersion ? `${c.templateVersion.template.code} v${c.templateVersion.version}` : "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-400">Sem resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
        <span>{total} processo(s)</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="btn btn-ghost !py-1.5" href={`?q=${encodeURIComponent(q)}&estado=${status ?? ""}&p=${page - 1}`}>Anterior</Link>}
          {page * PAGE < total && <Link className="btn btn-ghost !py-1.5" href={`?q=${encodeURIComponent(q)}&estado=${status ?? ""}&p=${page + 1}`}>Seguinte</Link>}
        </div>
      </div>
    </>
  );
}
