import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Badge, PageTitle, Panel, eur } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { audit } from "@/modules/audit";
import { requireAdmin } from "@/modules/auth/session";

const schema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_]{3,40}$/),
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  defenseDeadlineDays: z.coerce.number().int().min(1).max(365).optional().or(z.literal("").transform(() => undefined)),
  priceCents: z.coerce.number().min(0).transform((v) => Math.round(v * 100)),
  active: z.boolean(),
});

async function saveCategory(id: string | null, form: FormData) {
  "use server";
  const admin = await requireAdmin("ADMIN");
  const data = schema.parse({
    code: String(form.get("code") ?? "").toUpperCase(),
    name: form.get("name"),
    description: form.get("description") || undefined,
    defenseDeadlineDays: form.get("defenseDeadlineDays") ?? "",
    priceCents: form.get("price"),
    active: form.get("active") === "on",
  });
  const saved = id
    ? await db.infractionCategory.update({ where: { id }, data: { ...data, defenseDeadlineDays: data.defenseDeadlineDays ?? null } })
    : await db.infractionCategory.create({ data });
  await audit({ actorType: "ADMIN", actorId: admin.id, ip: await clientIp(), action: id ? "category.updated" : "category.created", entityType: "InfractionCategory", entityId: saved.id, meta: data });
  revalidatePath("/admin/categorias");
}

export default async function Categorias() {
  const admin = await requireAdmin();
  const categories = await db.infractionCategory.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { templates: true, cases: true } } } });
  const fields = (c?: (typeof categories)[number]) => (
    <div className="grid gap-3 md:grid-cols-6">
      <input name="code" defaultValue={c?.code} placeholder="CÓDIGO" className="input font-mono uppercase" required />
      <input name="name" defaultValue={c?.name} placeholder="Nome" className="input md:col-span-2" required />
      <input name="price" type="number" step="0.01" defaultValue={c ? c.priceCents / 100 : ""} placeholder="Preço €" className="input" required />
      <input name="defenseDeadlineDays" type="number" defaultValue={c?.defenseDeadlineDays ?? ""} placeholder="Prazo (dias úteis)" className="input" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={c?.active ?? false} /> Ativa</label>
      <input name="description" defaultValue={c?.description ?? ""} placeholder="Descrição" className="input md:col-span-6" />
    </div>
  );
  return (
    <>
      <PageTitle title="Categorias de infração" />
      <p className="mb-6 max-w-3xl text-sm text-ink-500">
        Novas categorias (estacionamento, álcool, telemóvel…) são adicionadas aqui e passam a funcionar quando tiverem minutas ativas,
        sem alterar a aplicação. O formulário público atual cobre apenas <b>EXCESSO_VELOCIDADE</b>. O prazo é meramente indicativo e deve ser validado juridicamente.
      </p>
      <div className="space-y-4">
        {categories.map((c) => (
          <Panel key={c.id}>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="font-semibold">{c.name}</span>
              {c.active ? <Badge tone="green">Ativa</Badge> : <Badge>Inativa</Badge>}
              <span className="text-ink-400">{eur(c.priceCents)} · {c._count.templates} minuta(s) · {c._count.cases} processo(s)</span>
            </div>
            {admin.role === "ADMIN" && (
              <form action={saveCategory.bind(null, c.id)} className="space-y-3">
                {fields(c)}
                <button className="btn btn-ghost !py-2">Guardar</button>
              </form>
            )}
          </Panel>
        ))}
        {admin.role === "ADMIN" && (
          <Panel title="Nova categoria">
            <form action={saveCategory.bind(null, null)} className="space-y-3">
              {fields()}
              <button className="btn btn-primary !py-2">Criar categoria</button>
            </form>
          </Panel>
        )}
      </div>
    </>
  );
}
