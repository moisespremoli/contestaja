import type { InfractionCategory, Template } from "@/generated/prisma/client";

/** Campos de metadados de uma minuta (usado em "nova" e no detalhe). */
export function TemplateMetaFields({ categories, t }: { categories: InfractionCategory[]; t?: Template }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="label">Código identificador</label>
        <input name="code" defaultValue={t?.code} required className="input font-mono uppercase" placeholder="VEL-PS-ANSR-01" />
      </div>
      <div>
        <label className="label">Nome interno</label>
        <input name="internalName" defaultValue={t?.internalName} required className="input" />
      </div>
      <div>
        <label className="label">Categoria de infração</label>
        <select name="categoryId" defaultValue={t?.categoryId} className="input">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Tipo de requerente</label>
        <select name="applicantType" defaultValue={t?.applicantType ?? "SINGULAR"} className="input">
          <option value="SINGULAR">Pessoa singular</option>
          <option value="COLETIVA">Pessoa coletiva</option>
        </select>
      </div>
      <div>
        <label className="label">Tipo de processo</label>
        <input name="processType" defaultValue={t?.processType ?? "DEFESA_ESCRITA"} required className="input" />
      </div>
      <div>
        <label className="label">Entidade competente</label>
        <input name="competentEntity" defaultValue={t?.competentEntity} required className="input" placeholder="Usada no marcador minuta.entidade_competente" />
      </div>
      <div className="md:col-span-2">
        <label className="label">Fundamentos aplicáveis (descrição interna)</label>
        <textarea name="groundsSummary" defaultValue={t?.groundsSummary ?? ""} rows={2} className="input" />
      </div>
      <div>
        <label className="label">Prioridade (desempate)</label>
        <input name="priority" type="number" defaultValue={t?.priority ?? 0} className="input" />
      </div>
      <div>
        <label className="label">Validada juridicamente por</label>
        <input name="legalValidatedBy" defaultValue={t?.legalValidatedBy ?? ""} className="input" placeholder="Nome e n.º de cédula profissional" />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiresReview" defaultChecked={t?.requiresReview} /> Exige revisão humana antes da entrega</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isTest" defaultChecked={t?.isTest} /> Minuta de teste</label>
    </div>
  );
}
