import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/modules/audit";
import { decryptJson, encryptJson, randomToken, sha256, signToken } from "@/modules/crypto";
import { fillDocx, resolveValues } from "@/modules/docgen/engine";
import { documentReadyEmail, sendMail } from "@/modules/email";
import { getPdfConverter } from "@/modules/pdf";
import { getPaymentProvider } from "@/modules/payments";
import type { Method, WebhookEvent } from "@/modules/payments/types";
import { selectTemplate, type SelectionResult } from "@/modules/selection/engine";
import { storage } from "@/modules/storage";
import type { ActorType, Case, CaseStatus, SelectionOutcome } from "@/generated/prisma/client";
import { buildContext } from "./derive";
import { caseDataSchema, type CaseData } from "./schema";

export { STATUS_LABELS } from "./labels";

const DOWNLOAD_TTL_HOURS = 72;

type Actor = { type: ActorType; id?: string | null; ip?: string | null };

function newReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomToken(8);
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[bytes.charCodeAt(i) % alphabet.length];
  return `CJ-${new Date().getFullYear()}-${s}`;
}

export function hashAccessToken(token: string) {
  return sha256(`case-access:${token}`);
}

export function caseData(c: Pick<Case, "dataEnc">): CaseData {
  return decryptJson<CaseData>(c.dataEnc);
}

/** Contexto completo para preenchimento (dados + derivados + metadados da minuta). */
async function contextFor(c: Case) {
  const category = await db.infractionCategory.findUniqueOrThrow({ where: { id: c.categoryId } });
  const version = c.templateVersionId
    ? await db.templateVersion.findUnique({ where: { id: c.templateVersionId }, include: { template: true, mappings: true } })
    : null;
  const ctx = {
    ...buildContext(caseData(c), { defenseDeadlineDays: category.defenseDeadlineDays }),
    minuta: version
      ? { entidade_competente: version.template.competentEntity, codigo: version.template.code, versao: version.version }
      : {},
  };
  return { ctx, version, category };
}

async function candidateTemplates(categoryId: string) {
  const templates = await db.template.findMany({ where: { categoryId }, include: { category: true } });
  return templates.map((t) => ({
    id: t.id,
    code: t.code,
    internalName: t.internalName,
    categoryCode: t.category.code,
    applicantType: t.applicantType,
    status: t.status,
    priority: t.priority,
    conditions: t.conditions,
    currentVersionId: t.currentVersionId,
  }));
}

function statusAfterSelection(outcome: SelectionResult["outcome"]): CaseStatus {
  switch (outcome) {
    case "SELECTED":
      return "AWAITING_PAYMENT";
    case "AMBIGUOUS":
      return "AWAITING_REVIEW";
    default:
      return "REJECTED_NO_TEMPLATE";
  }
}

export interface UploadedFile {
  kind: "NOTIFICATION" | "SUPPORTING";
  name: string;
  type: string;
  data: Buffer;
}

export async function createCase(input: unknown, files: UploadedFile[], actor: Actor) {
  const data = caseDataSchema.parse(input);
  const category = await db.infractionCategory.findUnique({ where: { code: data.categoria } });
  if (!category || !category.active) throw new Error("Categoria de infração indisponível");

  const token = randomToken(32);
  const reference = newReference();
  const displayName = data.requerente.tipo === "SINGULAR" ? data.requerente.nome : data.requerente.denominacao;
  const now = new Date();

  const created = await db.case.create({
    data: {
      reference,
      status: "FORM_COMPLETED",
      categoryId: category.id,
      applicantType: data.requerente.tipo,
      dataEnc: encryptJson(data),
      displayName,
      email: data.requerente.email,
      accessTokenHash: hashAccessToken(token),
      privacyConsentAt: now,
      termsAcceptedAt: now,
      disclaimersAt: now,
    },
  });

  for (const f of files) {
    const key = `cases/${created.id}/uploads/${randomToken(8)}${extensionFor(f.type)}`;
    await storage.put(key, f.data);
    await db.caseFile.create({
      data: {
        caseId: created.id,
        kind: f.kind,
        storageKey: key,
        originalName: f.name.slice(0, 200),
        mimeType: f.type,
        size: f.data.length,
        sha256: sha256(f.data),
      },
    });
  }

  await audit({ actorType: actor.type, ip: actor.ip, action: "case.created", entityType: "Case", entityId: created.id, meta: { reference, files: files.length } });
  const selection = await runSelection(created.id, { type: "SYSTEM" });
  return { case: created, token, selection };
}

function extensionFor(mime: string) {
  return mime === "application/pdf" ? ".pdf" : mime === "image/png" ? ".png" : mime === "image/jpeg" ? ".jpg" : ".bin";
}

export async function runSelection(caseId: string, actor: Actor) {
  const c = await db.case.findUniqueOrThrow({ where: { id: caseId }, include: { category: true } });
  const data = caseData(c);
  const ctx = buildContext(data, { defenseDeadlineDays: c.category.defenseDeadlineDays });
  const result = selectTemplate(
    { categoryCode: c.category.code, applicantType: c.applicantType, context: ctx },
    await candidateTemplates(c.categoryId),
  );
  await db.case.update({
    where: { id: caseId },
    data: {
      templateVersionId: result.templateVersionId ?? null,
      selectionOutcome: result.outcome as SelectionOutcome,
      selectionTrace: result as unknown as object,
      status: statusAfterSelection(result.outcome),
    },
  });
  await audit({
    actorType: actor.type,
    actorId: actor.id,
    action: "case.selection",
    entityType: "Case",
    entityId: caseId,
    meta: { outcome: result.outcome, templateId: result.templateId, message: result.message },
  });
  return result;
}

/** Seleção manual pelo administrador (exige confirmação expressa na UI; fica auditada). */
export async function overrideTemplate(caseId: string, templateId: string, reason: string, actor: Actor) {
  const c = await db.case.findUniqueOrThrow({ where: { id: caseId } });
  const t = await db.template.findUniqueOrThrow({ where: { id: templateId } });
  if (!t.currentVersionId) throw new Error("A minuta não tem versão carregada");
  const crossType = t.applicantType !== c.applicantType;
  const paid = await db.payment.count({ where: { caseId, status: "CONFIRMED" } });
  await db.case.update({
    where: { id: caseId },
    data: {
      templateVersionId: t.currentVersionId,
      selectionOutcome: "MANUAL_OVERRIDE",
      status: paid ? "AWAITING_REVIEW" : "AWAITING_PAYMENT",
    },
  });
  await audit({
    actorType: actor.type,
    actorId: actor.id,
    ip: actor.ip,
    action: "case.template_override",
    entityType: "Case",
    entityId: caseId,
    meta: { templateId, templateCode: t.code, reason, crossApplicantType: crossType },
  });
}

/** Campos obrigatórios (definidos pela minuta) que ainda não estão preenchidos. */
export async function missingRequiredFields(c: Case) {
  if (!c.templateVersionId) return [];
  const { ctx, version } = await contextFor(c);
  if (!version) return [];
  return resolveValues(version.mappings, ctx).missingRequired;
}

/** Atualiza campos do processo (ex.: dados em falta pedidos pela minuta), revalidando tudo. */
export async function patchCaseData(caseId: string, patch: Record<string, string>, actor: Actor) {
  const c = await db.case.findUniqueOrThrow({ where: { id: caseId } });
  if (!["FORM_COMPLETED", "AWAITING_PAYMENT", "AWAITING_REVIEW"].includes(c.status)) {
    throw new Error("O processo já não pode ser alterado");
  }
  const data = structuredClone(caseData(c)) as unknown as Record<string, Record<string, unknown>>;
  for (const [path, value] of Object.entries(patch)) {
    const [group, field] = path.split(".");
    if (!group || !field || !data[group] || ["calc", "flags", "minuta"].includes(group)) continue;
    data[group][field] = value;
  }
  const valid = caseDataSchema.parse(data);
  await db.case.update({ where: { id: caseId }, data: { dataEnc: encryptJson(valid) } });
  await audit({ actorType: actor.type, actorId: actor.id, action: "case.data_patched", entityType: "Case", entityId: caseId, meta: { fields: Object.keys(patch) } });
}

/** orderId do gateway: único, ≤ 15 caracteres (limite MB WAY/cartão ifthenpay). */
function newOrderId() {
  return `CJ${randomToken(16).replace(/[^A-Za-z0-9]/g, "").slice(0, 13)}`;
}

export async function startPayment(caseId: string, method: Method, phone: string | undefined, actor: Actor) {
  const c = await db.case.findUniqueOrThrow({ where: { id: caseId }, include: { category: true } });
  if (c.status !== "AWAITING_PAYMENT") throw new Error("Este processo não está a aguardar pagamento");
  if ((await missingRequiredFields(c)).length > 0) throw new Error("Existem dados obrigatórios em falta");
  if (await db.payment.count({ where: { caseId, status: "PENDING" } })) throw new Error("Já existe um pagamento pendente");
  const provider = getPaymentProvider();
  if (!provider.methods.includes(method)) throw new Error("Método de pagamento indisponível");

  const orderId = newOrderId();
  const callbackBase = `${env.appUrl}/api/payments/${provider.name}`;
  const created = await provider.create({
    caseId,
    caseReference: c.reference,
    orderId,
    amountCents: c.category.priceCents,
    method,
    phone,
    email: c.email,
    clientName: c.displayName,
    returnUrls: {
      success: `${callbackBase}/return?result=success`,
      error: `${callbackBase}/return?result=error`,
      cancel: `${callbackBase}/return?result=cancel`,
    },
    notificationUrl: `${callbackBase}/notification`,
  });
  const payment = await db.payment.create({
    data: {
      caseId,
      provider: provider.name,
      method,
      amountCents: c.category.priceCents,
      providerRef: orderId,
      providerRequestId: created.providerRequestId ?? null,
      instructions: created.instructions,
    },
  });
  await audit({ actorType: actor.type, ip: actor.ip, action: "payment.created", entityType: "Case", entityId: caseId, meta: { method, paymentId: payment.id, provider: provider.name } });
  return payment;
}

/** Abandona um pagamento pendente para escolher outro método. Um pagamento tardio continua a ser aceite. */
export async function cancelPendingPayment(caseId: string, actor: Actor) {
  const { count } = await db.payment.updateMany({ where: { caseId, status: "PENDING" }, data: { status: "EXPIRED" } });
  if (count) await audit({ actorType: actor.type, ip: actor.ip, action: "payment.abandoned", entityType: "Case", entityId: caseId });
}

/** Consulta ativa do estado no gateway (ex.: MB WAY) — complementa o callback. */
export async function syncPendingPayments(caseId: string) {
  const provider = getPaymentProvider();
  if (!provider.checkStatus) return;
  const pending = await db.payment.findMany({ where: { caseId, status: "PENDING", provider: provider.name } });
  for (const p of pending) {
    try {
      const event = await provider.checkStatus(p);
      if (event) await handlePaymentEvent(event);
    } catch (err) {
      console.error("[payments] falha ao consultar estado", p.id, err);
    }
  }
}

/** Processa um evento de pagamento já autenticado pelo provider. Idempotente. */
export async function handlePaymentEvent(event: WebhookEvent) {
  const payment = await db.payment.findUnique({ where: { providerRef: event.providerRef } });
  if (!payment) return { ok: false as const, reason: "payment_not_found" };
  if (payment.status === "CONFIRMED") return { ok: true as const, duplicate: true };
  // Um pagamento que já falhou/expirou só pode passar a confirmado (pagamento tardio).
  if (payment.status !== "PENDING" && event.status !== "CONFIRMED") return { ok: true as const, duplicate: true };
  const alreadyPaid = event.status === "CONFIRMED" && (await db.payment.count({ where: { caseId: payment.caseId, status: "CONFIRMED" } })) > 0;

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: event.status,
      raw: event.raw as object,
      confirmedAt: event.status === "CONFIRMED" ? new Date() : null,
    },
  });
  await audit({ actorType: "SYSTEM", action: `payment.${event.status.toLowerCase()}`, entityType: "Case", entityId: payment.caseId, meta: { paymentId: payment.id } });

  if (alreadyPaid) {
    // Pagamento em duplicado: fica registado para reembolso, sem voltar a gerar o documento.
    await audit({ actorType: "SYSTEM", action: "payment.duplicate_needs_refund", entityType: "Case", entityId: payment.caseId, meta: { paymentId: payment.id } });
    return { ok: true as const, duplicate: true };
  }
  if (event.status === "CONFIRMED") {
    await db.case.update({ where: { id: payment.caseId }, data: { status: "PAYMENT_CONFIRMED" } });
    await processPaidCase(payment.caseId);
  }
  return { ok: true as const };
}

/** Após pagamento: revisão humana se a minuta o exigir; caso contrário gera e entrega. */
export async function processPaidCase(caseId: string) {
  const c = await db.case.findUniqueOrThrow({ where: { id: caseId }, include: { templateVersion: { include: { template: true } } } });
  if (!c.templateVersion || c.templateVersion.template.requiresReview || c.selectionOutcome === "MANUAL_OVERRIDE") {
    await db.case.update({ where: { id: caseId }, data: { status: "AWAITING_REVIEW" } });
    return;
  }
  try {
    await generateAndDeliver(caseId, { type: "SYSTEM" });
  } catch (err) {
    console.error("[cases] geração automática falhou", caseId, err);
    await db.case.update({ where: { id: caseId }, data: { status: "AWAITING_REVIEW" } });
    await audit({ actorType: "SYSTEM", action: "document.generation_failed", entityType: "Case", entityId: caseId, meta: { error: String(err) } });
  }
}

export class GenerationBlockedError extends Error {
  constructor(public details: { missingRequired: { placeholder: string }[]; unmapped: string[] }) {
    super(
      [
        details.missingRequired.length ? `Campos obrigatórios em falta: ${details.missingRequired.map((m) => m.placeholder).join(", ")}` : "",
        details.unmapped.length ? `Marcadores sem mapeamento: ${details.unmapped.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(". "),
    );
  }
}

export async function generateAndDeliver(caseId: string, actor: Actor) {
  const c = await db.case.findUniqueOrThrow({ where: { id: caseId } });
  const paid = await db.payment.count({ where: { caseId, status: "CONFIRMED" } });
  if (!paid) throw new Error("Pagamento não confirmado — o documento não pode ser gerado");

  const { ctx, version } = await contextFor(c);
  if (!version) throw new Error("Processo sem minuta selecionada");

  const original = await storage.get(version.storageKey);
  const filled = fillDocx(original, version.mappings, ctx);
  if (filled.missingRequired.length || filled.unmapped.length) throw new GenerationBlockedError(filled);

  const pdf = await getPdfConverter().docxToPdf(filled.buffer);
  const base = `cases/${caseId}/documents/${Date.now()}`;
  await storage.put(`${base}.docx`, filled.buffer);
  await storage.put(`${base}.pdf`, pdf);

  const doc = await db.generatedDocument.create({
    data: { caseId, templateVersionId: version.id, docxKey: `${base}.docx`, pdfKey: `${base}.pdf`, pdfSha256: sha256(pdf) },
  });
  await db.case.update({ where: { id: caseId }, data: { status: "DOCUMENT_GENERATED" } });
  await audit({
    actorType: actor.type,
    actorId: actor.id,
    action: "document.generated",
    entityType: "Case",
    entityId: caseId,
    meta: { documentId: doc.id, templateCode: version.template.code, version: version.version },
  });

  await deliverDocument(doc.id, actor);
  return doc;
}

export function documentDownloadUrl(documentId: string, kind: "pdf" | "docx" = "pdf", ttlHours = DOWNLOAD_TTL_HOURS) {
  const token = signToken(env.downloadSigningSecret, JSON.stringify({ d: documentId, k: kind }), ttlHours * 3600);
  return `${env.appUrl}/api/download/${token}`;
}

export async function deliverDocument(documentId: string, actor: Actor) {
  const doc = await db.generatedDocument.findUniqueOrThrow({ where: { id: documentId }, include: { case: true } });
  const mail = documentReadyEmail({ reference: doc.case.reference, link: documentDownloadUrl(doc.id), expiresHours: DOWNLOAD_TTL_HOURS });
  await sendMail({ to: doc.case.email, ...mail });
  const retentionUntil = new Date(Date.now() + env.retentionDays * 864e5);
  await db.generatedDocument.update({ where: { id: documentId }, data: { deliveredAt: new Date() } });
  await db.case.update({ where: { id: doc.caseId }, data: { status: "DELIVERED", retentionUntil } });
  await audit({ actorType: actor.type, actorId: actor.id, action: "document.delivered", entityType: "Case", entityId: doc.caseId, meta: { documentId } });
}

/** Elimina ficheiros e anonimiza o processo (RGPD). Mantém registos financeiros mínimos. */
export async function anonymizeCase(caseId: string, actor: Actor) {
  await storage.removePrefix(`cases/${caseId}`);
  await db.caseFile.deleteMany({ where: { caseId } });
  await db.case.update({
    where: { id: caseId },
    data: {
      dataEnc: encryptJson({ anonymized: true }),
      displayName: "[anonimizado]",
      email: "anonimizado@invalid",
      selectionTrace: undefined,
      anonymizedAt: new Date(),
    },
  });
  await audit({ actorType: actor.type, actorId: actor.id, ip: actor.ip, action: "case.anonymized", entityType: "Case", entityId: caseId });
}
