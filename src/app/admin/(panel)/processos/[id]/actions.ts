"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { requireAdmin } from "@/modules/auth/session";
import {
  anonymizeCase,
  deliverDocument,
  generateAndDeliver,
  overrideTemplate,
  runSelection,
} from "@/modules/cases/service";

async function actor() {
  const admin = await requireAdmin();
  return { admin, actor: { type: "ADMIN" as const, id: admin.id, ip: await clientIp() } };
}

function back(id: string, msg: string, ok = true): never {
  revalidatePath(`/admin/processos/${id}`);
  redirect(`/admin/processos/${id}?${ok ? "ok" : "erro"}=${encodeURIComponent(msg)}`);
}

export async function approveAndGenerate(id: string) {
  const { actor: a } = await actor();
  let msg = "Documento gerado e entregue ao cliente.";
  let ok = true;
  try {
    await generateAndDeliver(id, a);
  } catch (e) {
    msg = e instanceof Error ? e.message : "Falha na geração";
    ok = false;
  }
  back(id, msg, ok);
}

export async function rerunSelection(id: string) {
  const { actor: a } = await actor();
  const c = await db.case.findUniqueOrThrow({ where: { id } });
  if (await db.payment.count({ where: { caseId: id, status: "CONFIRMED" } })) {
    back(id, "Processo já pago — use a seleção manual.", false);
  }
  const r = await runSelection(c.id, a);
  back(id, `Seleção: ${r.message}`, r.outcome === "SELECTED");
}

export async function overrideTemplateAction(id: string, form: FormData) {
  const { actor: a } = await actor();
  const templateId = String(form.get("templateId") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const confirm = form.get("confirm") === "on";
  const confirmCross = form.get("confirmCross") === "on";
  if (!templateId || reason.length < 10 || !confirm) back(id, "Indique a minuta, uma justificação (mín. 10 caracteres) e confirme.", false);
  const [c, t] = await Promise.all([db.case.findUniqueOrThrow({ where: { id } }), db.template.findUniqueOrThrow({ where: { id: templateId } })]);
  if (t.applicantType !== c.applicantType && !confirmCross) {
    back(id, "A minuta destina-se a outro tipo de requerente. É necessária validação expressa adicional.", false);
  }
  await overrideTemplate(id, templateId, reason, a);
  back(id, `Minuta ${t.code} atribuída manualmente.`);
}

export async function resendDocument(id: string) {
  const { actor: a } = await actor();
  const doc = await db.generatedDocument.findFirst({ where: { caseId: id }, orderBy: { createdAt: "desc" } });
  if (!doc) back(id, "Sem documento gerado.", false);
  await deliverDocument(doc.id, a);
  back(id, "Email reenviado ao cliente.");
}

export async function anonymizeAction(id: string, form: FormData) {
  const admin = await requireAdmin("ADMIN");
  if (form.get("confirm") !== "ELIMINAR") back(id, "Escreva ELIMINAR para confirmar.", false);
  await anonymizeCase(id, { type: "ADMIN", id: admin.id, ip: await clientIp() });
  back(id, "Dados eliminados/anonimizados.");
}
