import Link from "next/link";
import { Badge, PageTitle, fmtDate } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/session";

export default async function Auditoria({ searchParams }: PageProps<"/admin/auditoria">) {
  await requireAdmin("ADMIN");
  const { acao } = await searchParams;
  const logs = await db.auditLog.findMany({
    where: typeof acao === "string" && acao ? { action: { startsWith: acao } } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const admins = new Map((await db.adminUser.findMany()).map((a) => [a.id, a.email]));
  return (
    <>
      <PageTitle title="Registo de auditoria" />
      <form className="mb-4 flex gap-3">
        <input name="acao" defaultValue={typeof acao === "string" ? acao : ""} placeholder="Filtrar ação (ex.: admin., template., document.)" className="input max-w-sm" />
        <button className="btn btn-primary">Filtrar</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-ink-100 text-left text-xs text-ink-500">
            <tr>{["Data", "Ator", "Ação", "Entidade", "IP", "Detalhes"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2 text-ink-500">{fmtDate(l.createdAt)}</td>
                <td className="px-4 py-2"><Badge tone={l.actorType === "ADMIN" ? "violet" : l.actorType === "CLIENT" ? "neutral" : "amber"}>{l.actorType}</Badge> <span className="text-xs">{l.actorId ? admins.get(l.actorId) ?? "" : ""}</span></td>
                <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-2 text-xs">
                  {l.entityType === "Case" ? <Link className="underline" href={`/admin/processos/${l.entityId}`}>Processo</Link> : l.entityType === "Template" ? <Link className="underline" href={`/admin/minutas/${l.entityId}`}>Minuta</Link> : l.entityType}
                </td>
                <td className="px-4 py-2 text-xs text-ink-400">{l.ip ?? "—"}</td>
                <td className="max-w-md truncate px-4 py-2 text-xs text-ink-400">{l.meta ? JSON.stringify(l.meta) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
