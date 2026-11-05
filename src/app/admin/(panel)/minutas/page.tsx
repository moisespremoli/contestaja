import Link from "next/link";
import { Badge, PageTitle } from "@/components/admin-ui";
import { db } from "@/lib/db";

export default async function Minutas() {
  const templates = await db.template.findMany({
    orderBy: [{ categoryId: "asc" }, { applicantType: "asc" }, { priority: "desc" }],
    include: { category: true, currentVersion: true, _count: { select: { versions: true } } },
  });
  return (
    <>
      <PageTitle title="Biblioteca de minutas">
        <Link href="/admin/minutas/nova" className="btn btn-primary">Carregar nova minuta</Link>
      </PageTitle>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-ink-100 text-left text-xs text-ink-500">
            <tr>
              {["Código", "Nome interno", "Categoria", "Requerente", "Entidade competente", "Versão", "Prioridade", "Estado"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {templates.map((t) => (
              <tr key={t.id} className="hover:bg-ink-50">
                <td className="px-4 py-3 font-mono text-xs"><Link className="underline" href={`/admin/minutas/${t.id}`}>{t.code}</Link></td>
                <td className="px-4 py-3">{t.internalName} {t.isTest && <Badge tone="amber">TESTE</Badge>}</td>
                <td className="px-4 py-3">{t.category.name}</td>
                <td className="px-4 py-3">{t.applicantType === "SINGULAR" ? "Pessoa singular" : "Pessoa coletiva"}</td>
                <td className="px-4 py-3">{t.competentEntity}</td>
                <td className="px-4 py-3">{t.currentVersion ? `v${t.currentVersion.version}` : "—"} <span className="text-xs text-ink-400">({t._count.versions})</span></td>
                <td className="px-4 py-3">{t.priority}</td>
                <td className="px-4 py-3">{t.status === "ACTIVE" ? <Badge tone="green">Ativa</Badge> : <Badge>Inativa</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
