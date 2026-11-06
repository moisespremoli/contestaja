import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Badge, PageTitle, Panel, fmtDate } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { audit } from "@/modules/audit";
import { requireAdmin } from "@/modules/auth/session";
import { COUPON_CODE_RE, couponProblem, normalizeCouponCode } from "@/modules/coupons/rules";

const optionalInt = z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined));

const schema = z.object({
  code: z.string().regex(COUPON_CODE_RE, "Código: 3–40 caracteres (A–Z, 0–9, _ ou -)"),
  percentOff: z.coerce.number().int().min(1).max(100),
  maxUses: optionalInt,
  validUntil: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(`${v}T23:59:59`) : undefined)),
  active: z.boolean(),
  isTest: z.boolean(),
  note: z.string().trim().max(200).optional(),
});

async function saveCoupon(id: string | null, form: FormData) {
  "use server";
  const admin = await requireAdmin("ADMIN");
  const data = schema.parse({
    code: normalizeCouponCode(String(form.get("code") ?? "")),
    percentOff: form.get("percentOff"),
    maxUses: form.get("maxUses") ?? "",
    validUntil: String(form.get("validUntil") ?? "") || undefined,
    active: form.get("active") === "on",
    isTest: form.get("isTest") === "on",
    note: String(form.get("note") ?? "") || undefined,
  });
  const row = { ...data, maxUses: data.maxUses ?? null, validUntil: data.validUntil ?? null, note: data.note ?? null };
  const saved = id ? await db.coupon.update({ where: { id }, data: row }) : await db.coupon.create({ data: row });
  await audit({ actorType: "ADMIN", actorId: admin.id, ip: await clientIp(), action: id ? "coupon.updated" : "coupon.created", entityType: "Coupon", entityId: saved.id, meta: row });
  revalidatePath("/admin/cupoes");
}

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function Cupoes() {
  const admin = await requireAdmin();
  const coupons = await db.coupon.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { payments: { where: { status: "CONFIRMED" } } } } },
  });
  const fields = (c?: (typeof coupons)[number]) => (
    <div className="grid gap-3 md:grid-cols-6">
      <input name="code" defaultValue={c?.code} placeholder="CÓDIGO" className="input font-mono uppercase md:col-span-2" required />
      <input name="percentOff" type="number" min={1} max={100} defaultValue={c?.percentOff ?? 100} placeholder="% desconto" className="input" required />
      <input name="maxUses" type="number" min={1} defaultValue={c?.maxUses ?? ""} placeholder="Máx. utilizações" className="input" />
      <input name="validUntil" type="date" defaultValue={isoDate(c?.validUntil ?? null)} className="input" aria-label="Válido até" />
      <div className="flex flex-col justify-center gap-1 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> Ativo</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isTest" defaultChecked={c?.isTest ?? false} /> Teste</label>
      </div>
      <input name="note" defaultValue={c?.note ?? ""} placeholder="Nota interna" className="input md:col-span-6" />
    </div>
  );
  return (
    <>
      <PageTitle title="Cupões" />
      <p className="mb-6 max-w-3xl text-sm text-ink-500">
        O cliente introduz o código na página de pagamento. Um cupão de <b>100%</b> conclui o pedido sem passar pelo gateway e o documento é
        gerado tal como num pedido pago. Cupões marcados como <b>Teste</b> são excluídos das métricas do dashboard. Limite as utilizações ou
        desative os cupões de teste antes da abertura ao público.
      </p>
      <div className="space-y-4">
        {coupons.map((c) => {
          const problem = couponProblem(c);
          return (
            <Panel key={c.id}>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono font-semibold">{c.code}</span>
                {problem ? <Badge tone="red">{c.active ? "Indisponível" : "Inativo"}</Badge> : <Badge tone="green">Ativo</Badge>}
                {c.isTest && <Badge tone="amber">Teste</Badge>}
                <span className="text-ink-400">
                  −{c.percentOff}% · {c.usedCount}
                  {c.maxUses != null ? `/${c.maxUses}` : ""} utilização(ões)
                  {c.validUntil ? ` · até ${fmtDate(c.validUntil)}` : ""} · criado {fmtDate(c.createdAt)}
                </span>
              </div>
              {admin.role === "ADMIN" && (
                <form action={saveCoupon.bind(null, c.id)} className="space-y-3">
                  {fields(c)}
                  <button className="btn btn-ghost !py-2">Guardar</button>
                </form>
              )}
            </Panel>
          );
        })}
        {admin.role === "ADMIN" && (
          <Panel title="Novo cupão">
            <form action={saveCoupon.bind(null, null)} className="space-y-3">
              {fields()}
              <button className="btn btn-primary !py-2">Criar cupão</button>
            </form>
          </Panel>
        )}
      </div>
    </>
  );
}
