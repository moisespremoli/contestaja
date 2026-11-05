"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/request";
import { hashAccessToken, missingRequiredFields, patchCaseData, startPayment } from "@/modules/cases/service";
import { isValidPhone } from "@/modules/fields/validators";
import { ZodError } from "zod";

export type ActionState = { error?: string; ok?: boolean } | undefined;

async function caseFor(token: string) {
  return db.case.findUnique({ where: { accessTokenHash: hashAccessToken(token) } });
}

export async function payAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!rateLimit(`pay:${ip}`, 20, 60 * 60 * 1000)) return { error: "Demasiadas tentativas. Tente mais tarde." };
  const c = await caseFor(token);
  if (!c) return { error: "Processo não encontrado." };
  const method = String(form.get("method") ?? "");
  if (!["MBWAY", "CARD", "MULTIBANCO"].includes(method)) return { error: "Escolha um método de pagamento." };
  const phone = String(form.get("phone") ?? "").replace(/\D/g, "").replace(/^351/, "");
  if (method === "MBWAY" && !isValidPhone(phone)) return { error: "Indique um número de telemóvel MB WAY válido." };
  try {
    await startPayment(c.id, method as "MBWAY" | "CARD" | "MULTIBANCO", phone || undefined, { type: "CLIENT", ip });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível iniciar o pagamento." };
  }
  revalidatePath(`/p/${token}`);
  return { ok: true };
}

export async function completeFieldsAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const c = await caseFor(token);
  if (!c) return { error: "Processo não encontrado." };
  const allowed = new Set((await missingRequiredFields(c)).map((m) => m.sourcePath));
  const patch: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (allowed.has(k) && typeof v === "string" && v.trim()) patch[k] = v.trim();
  }
  if (Object.keys(patch).length === 0) return { error: "Preencha os campos em falta." };
  try {
    await patchCaseData(c.id, patch, { type: "CLIENT", ip: await clientIp() });
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues.map((i) => i.message).join(" · ") };
    return { error: e instanceof Error ? e.message : "Não foi possível guardar." };
  }
  revalidatePath(`/p/${token}`);
  return { ok: true };
}
