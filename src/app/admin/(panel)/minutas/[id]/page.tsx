import { notFound } from "next/navigation";
import { Badge, PageTitle, Panel, fmtDate } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/session";
import type { Placeholder } from "@/modules/docgen/engine";
import { CONDITION_FIELDS, FIELD_CATALOG, FORMATS } from "@/modules/fields/catalog";
import { OPERATOR_LABELS } from "@/modules/selection/conditions";
import { versionReadiness } from "@/modules/templates/service";
import { saveMappings, setCurrentVersion, setTemplateStatus, updateConditions, updateTemplateMeta, uploadVersion } from "../actions";
import { TemplateMetaFields } from "../meta-fields";
import { ConditionsEditor, MappingEditor } from "./editors";

export default async function MinutaDetalhe({ params, searchParams }: PageProps<"/admin/minutas/[id]">) {
  const admin = await requireAdmin();
  const isAdmin = admin.role === "ADMIN";
  const { id } = await params;
  const sp = await searchParams;
  const t = await db.template.findUnique({
    where: { id },
    include: {
      category: true,
      versions: { orderBy: { version: "desc" }, include: { mappings: true, createdBy: true, _count: { select: { cases: true } } } },
    },
  });
  if (!t) notFound();
  const categories = await db.infractionCategory.findMany();
  const requestedVersion = typeof sp.v === "string" ? sp.v : null;
  const editing = t.versions.find((v) => v.id === requestedVersion) ?? t.versions.find((v) => v.id === t.currentVersionId) ?? t.versions[0];
  const readiness = editing ? await versionReadiness(editing.id) : null;
  const editingIsCurrent = editing?.id === t.currentVersionId;
  // Uma versão já utilizada em processos é imutável, incluindo o seu mapeamento.
  const locked = !!editing && editing._count.cases > 0;

  return (
    <>
      <PageTitle title={`${t.code}`}>
        <div className="flex items-center gap-2">
          {t.isTest && <Badge tone="amber">TESTE</Badge>}
          {t.status === "ACTIVE" ? <Badge tone="green">Ativa</Badge> : <Badge>Inativa</Badge>}
          {isAdmin && (
            <form action={setTemplateStatus.bind(null, id, t.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
              <button className={`btn ${t.status === "ACTIVE" ? "btn-ghost" : "btn-accent"} !py-2`}>{t.status === "ACTIVE" ? "Desativar" : "Ativar"}</button>
            </form>
          )}
        </div>
      </PageTitle>
      {typeof sp.ok === "string" && <p className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{sp.ok}</p>}
      {typeof sp.erro === "string" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{sp.erro}</p>}

      <div className="space-y-6">
        <Panel title="Metadados">
          <form action={updateTemplateMeta.bind(null, id)} className="space-y-4">
            <TemplateMetaFields categories={categories} t={t} />
            <p className="text-xs text-ink-400">
              Validação jurídica: {t.legalValidatedBy ? `${t.legalValidatedBy} em ${fmtDate(t.legalValidatedAt)}` : "não registada"}
            </p>
            {isAdmin && <button className="btn btn-primary">Guardar metadados</button>}
          </form>
        </Panel>

        <Panel title="Condições de utilização (motor de seleção)">
          <p className="mb-4 text-sm text-ink-500">
            A minuta só é escolhida para processos da categoria <b>{t.category.name}</b> com requerente{" "}
            <b>{t.applicantType === "SINGULAR" ? "pessoa singular" : "pessoa coletiva"}</b> e que cumpram estas condições.
          </p>
          {isAdmin ? (
            <ConditionsEditor
              initial={t.conditions as { all?: never[]; any?: never[] }}
              fields={CONDITION_FIELDS}
              operators={OPERATOR_LABELS}
              save={updateConditions.bind(null, id)}
            />
          ) : (
            <pre className="overflow-x-auto rounded-lg bg-ink-50 p-3 text-xs">{JSON.stringify(t.conditions, null, 2)}</pre>
          )}
        </Panel>

        <Panel title="Versões">
          <ul className="divide-y divide-ink-100 text-sm">
            {t.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    v{v.version} · {v.originalFilename}{" "}
                    {v.id === t.currentVersionId && <Badge tone="green">corrente</Badge>}
                  </p>
                  <p className="text-xs text-ink-400">
                    {fmtDate(v.createdAt)} · {v.createdBy?.name ?? "seed"} · {v._count.cases} processo(s) · SHA-256 {v.sha256.slice(0, 12)}… {v.notes && `· ${v.notes}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <a href={`?v=${v.id}`} className="btn btn-ghost !px-3 !py-1.5">Mapeamento</a>
                  <a href={`/api/admin/files?kind=template&id=${v.id}`} className="btn btn-ghost !px-3 !py-1.5">DOCX original</a>
                  <a href={`/api/admin/files?kind=test-pdf&id=${v.id}`} target="_blank" className="btn btn-ghost !px-3 !py-1.5">Testar (PDF)</a>
                  <a href={`/api/admin/files?kind=test-docx&id=${v.id}`} className="btn btn-ghost !px-3 !py-1.5">Testar (DOCX)</a>
                  {isAdmin && v.id !== t.currentVersionId && (
                    <form action={setCurrentVersion.bind(null, id, v.id)}>
                      <button className="btn btn-primary !px-3 !py-1.5">Tornar corrente</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {isAdmin && (
            <form action={uploadVersion.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3 border-t border-ink-100 pt-4">
              <div>
                <label className="label">Nova versão (DOCX)</label>
                <input type="file" name="file" accept=".docx" required className="text-sm" />
              </div>
              <input name="notes" placeholder="Notas da versão" className="input max-w-xs" />
              <button className="btn btn-ghost">Carregar versão</button>
            </form>
          )}
        </Panel>

        {editing && (
          <Panel title={`Mapeamento de variáveis — v${editing.version}${editingIsCurrent ? " (corrente)" : ""}`}>
            {readiness && !readiness.ready && (
              <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Marcadores por mapear: {readiness.unmapped.join(", ")}</p>
            )}
            {locked && (
              <p className="mb-3 rounded-lg bg-ink-50 p-2 text-sm text-ink-600">
                Esta versão já foi usada em processos — o mapeamento está bloqueado. Carregue uma nova versão para alterar.
              </p>
            )}
            <MappingEditor
              key={editing.id}
              placeholders={editing.placeholders as unknown as Placeholder[]}
              initial={editing.mappings.map((m) => ({ ...m, defaultValue: m.defaultValue ?? undefined }))}
              catalog={FIELD_CATALOG}
              formats={FORMATS}
              save={saveMappings.bind(null, editing.id)}
              readOnly={!isAdmin || locked}
            />
          </Panel>
        )}
      </div>
    </>
  );
}
