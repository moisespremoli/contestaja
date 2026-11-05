import { PageTitle, Panel } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/session";
import { createTemplate } from "../actions";
import { TemplateMetaFields } from "../meta-fields";

export default async function NovaMinuta({ searchParams }: PageProps<"/admin/minutas/nova">) {
  await requireAdmin("ADMIN");
  const { erro } = await searchParams;
  const categories = await db.infractionCategory.findMany({ where: { active: true } });
  return (
    <>
      <PageTitle title="Carregar nova minuta" />
      {typeof erro === "string" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <Panel>
        <form action={createTemplate} className="space-y-6">
          <TemplateMetaFields categories={categories} />
          <div>
            <label className="label">Ficheiro DOCX original</label>
            <input type="file" name="file" accept=".docx" required className="block text-sm" />
            <p className="mt-1 text-xs text-ink-400">
              Use marcadores {"{{NOME_DO_CAMPO}}"} e, para parágrafos condicionais aprovados, {"{{#CONDICAO}}…{{/CONDICAO}}"}.
            </p>
          </div>
          <div>
            <label className="label">Notas da versão</label>
            <input name="notes" className="input" />
          </div>
          <p className="text-sm text-ink-500">A minuta é criada <b>inativa</b>. Depois configure o mapeamento, as condições e teste o preenchimento.</p>
          <button className="btn btn-primary">Criar minuta</button>
        </form>
      </Panel>
    </>
  );
}
