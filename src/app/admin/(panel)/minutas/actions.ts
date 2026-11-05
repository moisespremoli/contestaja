"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { audit } from "@/modules/audit";
import { requireAdmin } from "@/modules/auth/session";
import { TemplateError } from "@/modules/docgen/engine";
import { FORMATS } from "@/modules/fields/catalog";
import { conditionsSchema } from "@/modules/selection/conditions";
import { addTemplateVersion, makeVersionCurrent, versionReadiness } from "@/modules/templates/service";

function go(path: string, msg: string, ok = true): never {
  revalidatePath(path);
  redirect(`${path}?${ok ? "ok" : "erro"}=${encodeURIComponent(msg)}`);
}

const metaSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_-]{3,40}$/, "Código: 3–40 caracteres A-Z, 0-9, _ ou -"),
  internalName: z.string().trim().min(3, "Nome interno obrigatório"),
  categoryId: z.string().min(1),
  applicantType: z.enum(["SINGULAR", "COLETIVA"]),
  processType: z.string().trim().min(2, "Tipo de processo obrigatório"),
  competentEntity: z.string().trim().min(2, "Entidade competente obrigatória"),
  groundsSummary: z.string().trim().optional(),
  priority: z.coerce.number().int().min(-100).max(100),
  requiresReview: z.boolean(),
  isTest: z.boolean(),
  legalValidatedBy: z.string().trim().optional(),
});

function readMeta(form: FormData) {
  return metaSchema.safeParse({
    code: String(form.get("code") ?? "").toUpperCase(),
    internalName: form.get("internalName"),
    categoryId: form.get("categoryId"),
    applicantType: form.get("applicantType"),
    processType: form.get("processType"),
    competentEntity: form.get("competentEntity"),
    groundsSummary: form.get("groundsSummary") || undefined,
    priority: form.get("priority") || 0,
    requiresReview: form.get("requiresReview") === "on",
    isTest: form.get("isTest") === "on",
    legalValidatedBy: form.get("legalValidatedBy") || undefined,
  });
}

async function readDocx(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.name.toLowerCase().endsWith(".docx")) throw new TemplateError("O ficheiro tem de ser .docx");
  return { name: file.name, data: Buffer.from(await file.arrayBuffer()) };
}

export async function createTemplate(form: FormData) {
  const admin = await requireAdmin("ADMIN");
  const meta = readMeta(form);
  if (!meta.success) go("/admin/minutas/nova", meta.error.issues[0].message, false);
  if (await db.template.findUnique({ where: { code: meta.data.code } })) go("/admin/minutas/nova", "Já existe uma minuta com esse código.", false);

  let docx;
  try {
    docx = await readDocx(form);
  } catch (e) {
    go("/admin/minutas/nova", (e as Error).message, false);
  }
  if (!docx) go("/admin/minutas/nova", "Carregue o ficheiro DOCX da minuta.", false);

  const { legalValidatedBy, ...rest } = meta.data;
  const t = await db.template.create({
    data: {
      ...rest,
      legalValidatedBy: legalValidatedBy ?? null,
      legalValidatedAt: legalValidatedBy ? new Date() : null,
      status: "INACTIVE",
      conditions: { all: [{ field: "requerente.tipo", op: "eq", value: rest.applicantType }], any: [] },
    },
  });
  try {
    await addTemplateVersion(t.id, docx, String(form.get("notes") ?? "") || null, admin.id);
  } catch (e) {
    await db.template.delete({ where: { id: t.id } });
    go("/admin/minutas/nova", e instanceof Error ? e.message : "DOCX inválido", false);
  }
  await audit({ actorType: "ADMIN", actorId: admin.id, ip: await clientIp(), action: "template.created", entityType: "Template", entityId: t.id, meta: { code: t.code } });
  go(`/admin/minutas/${t.id}`, "Minuta criada (inativa). Configure o mapeamento e teste antes de ativar.");
}

export async function updateTemplateMeta(id: string, form: FormData) {
  const admin = await requireAdmin("ADMIN");
  const meta = readMeta(form);
  const path = `/admin/minutas/${id}`;
  if (!meta.success) go(path, meta.error.issues[0].message, false);
  const before = await db.template.findUniqueOrThrow({ where: { id } });
  const { legalValidatedBy, ...rest } = meta.data;
  if (rest.code !== before.code && (await db.template.findUnique({ where: { code: rest.code } }))) go(path, "Código já existente.", false);
  await db.template.update({
    where: { id },
    data: {
      ...rest,
      legalValidatedBy: legalValidatedBy ?? null,
      legalValidatedAt: legalValidatedBy && legalValidatedBy !== before.legalValidatedBy ? new Date() : legalValidatedBy ? before.legalValidatedAt : null,
    },
  });
  await audit({ actorType: "ADMIN", actorId: admin.id, ip: await clientIp(), action: "template.meta_updated", entityType: "Template", entityId: id, meta: { before: { ...before, conditions: undefined }, after: meta.data } });
  go(path, "Metadados guardados.");
}

export async function updateConditions(id: string, json: string) {
  const admin = await requireAdmin("ADMIN");
  const path = `/admin/minutas/${id}`;
  let parsed;
  try {
    parsed = conditionsSchema.parse(JSON.parse(json));
  } catch {
    return { error: "Condições inválidas." };
  }
  const t = await db.template.findUniqueOrThrow({ where: { id } });
  const typeRule = parsed.all.find((r) => r.field === "requerente.tipo");
  if (typeRule && !(typeRule.op === "eq" && typeRule.value === t.applicantType)) {
    return { error: "A condição de tipo de requerente tem de coincidir com o tipo da minuta." };
  }
  await db.template.update({ where: { id }, data: { conditions: parsed as object } });
  await audit({ actorType: "ADMIN", actorId: admin.id, ip: await clientIp(), action: "template.conditions_updated", entityType: "Template", entityId: id, meta: { before: t.conditions, after: parsed } });
  revalidatePath(path);
  return { ok: true };
}

export async function setTemplateStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  const admin = await requireAdmin("ADMIN");
  const path = `/admin/minutas/${id}`;
  const t = await db.template.findUniqueOrThrow({ where: { id } });
  if (status === "ACTIVE") {
    if (!t.currentVersionId) go(path, "Defina uma versão corrente antes de ativar.", false);
    const { ready, unmapped } = await versionReadiness(t.currentVersionId);
    if (!ready) go(path, `Marcadores sem mapeamento: ${unmapped.join(", ")}`, false);
    if (!t.isTest && !t.legalValidatedBy) go(path, "Registe a validação jurídica antes de ativar uma minuta de produção.", false);
  }
  await db.template.update({ where: { id }, data: { status } });
  await audit({ actorType: "ADMIN", actorId: admin.id, ip: await clientIp(), action: status === "ACTIVE" ? "template.activated" : "template.deactivated", entityType: "Template", entityId: id });
  go(path, status === "ACTIVE" ? "Minuta ativada." : "Minuta desativada.");
}

export async function uploadVersion(id: string, form: FormData) {
  const admin = await requireAdmin("ADMIN");
  const path = `/admin/minutas/${id}`;
  try {
    const docx = await readDocx(form);
    if (!docx) go(path, "Escolha um ficheiro DOCX.", false);
    const v = await addTemplateVersion(id, docx, String(form.get("notes") ?? "") || null, admin.id);
    go(`${path}`, `Versão ${v.version} carregada. Reveja o mapeamento e teste antes de a tornar corrente.`);
  } catch (e) {
    if (e instanceof TemplateError) go(path, e.message, false);
    throw e;
  }
}

export async function setCurrentVersion(id: string, versionId: string) {
  const admin = await requireAdmin("ADMIN");
  try {
    await makeVersionCurrent(id, versionId, admin.id);
  } catch (e) {
    go(`/admin/minutas/${id}`, (e as Error).message, false);
  }
  go(`/admin/minutas/${id}`, "Versão definida como corrente.");
}

const mappingSchema = z.array(
  z.object({
    placeholder: z.string().min(1),
    sourcePath: z.string(),
    format: z.string().refine((f) => f in FORMATS),
    required: z.boolean(),
    defaultValue: z.string().optional(),
  }),
);

export async function saveMappings(versionId: string, json: string) {
  const admin = await requireAdmin("ADMIN");
  const v = await db.templateVersion.findUniqueOrThrow({ where: { id: versionId }, include: { template: true, _count: { select: { cases: true } } } });
  if (v._count.cases > 0) return { error: "Versão já utilizada em processos — crie uma nova versão." };
  const parsed = mappingSchema.safeParse(JSON.parse(json));
  if (!parsed.success) return { error: "Mapeamento inválido." };
  const rows = parsed.data.filter((m) => m.sourcePath);
  await db.$transaction([
    db.templateFieldMapping.deleteMany({ where: { templateVersionId: versionId } }),
    db.templateFieldMapping.createMany({
      data: rows.map((m) => ({ ...m, defaultValue: m.defaultValue || null, templateVersionId: versionId })),
    }),
  ]);
  await audit({ actorType: "ADMIN", actorId: admin.id, ip: await clientIp(), action: "template.mappings_saved", entityType: "Template", entityId: v.templateId, meta: { version: v.version, count: rows.length } });
  revalidatePath(`/admin/minutas/${v.templateId}`);
  return { ok: true, count: rows.length };
}
