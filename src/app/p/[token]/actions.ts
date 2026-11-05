"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { PAYMENT_RETURN_COOKIE } from "@/modules/payments/types";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/request";
import { cancelPendingPayment, hashAccessToken, missingRequiredFields, patchCaseData, startPayment } from "@/modules/cases/service";
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
  let redirectUrl: string | undefined;
  try {
    const payment = await startPayment(c.id, method as "MBWAY" | "CARD" | "MULTIBANCO", phone || undefined, { type: "CLIENT", ip });
    redirectUrl = (payment.instructions as { redirectUrl?: string } | null)?.redirectUrl;
  } catch (e) {
    console.error("[pay]", e);
    return { error: e instanceof Error ? e.message : "Não foi possível iniciar o pagamento." };
  }
  if (method === "CARD") {
    // Permite devolver o cliente à sua área do processo após a página do gateway.
    (await cookies()).set(PAYMENT_RETURN_COOKIE, token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/api/payments",
      maxAge: 60 * 60,
    });
    if (redirectUrl?.startsWith("https://")) redirect(redirectUrl);
  }
  revalidatePath(`/p/${token}`);
  return { ok: true };
}

export async function cancelPaymentAction(token: string) {
  const c = await caseFor(token);
  if (!c) return;
  await cancelPendingPayment(c.id, { type: "CLIENT", ip: await clientIp() });
  revalidatePath(`/p/${token}`);
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
