import { db } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { audit } from "@/modules/audit";
import { handlePaymentEvent } from "@/modules/cases/service";
import { ifthenpayConfig } from "@/modules/payments";
import { amountMatches, validCallbackKey } from "@/modules/payments/ifthenpay";

/**
 * Callback ifthenpay (GET), chamado após pagamento confirmado. URL a ativar na ifthenpay:
 *   {APP_URL}/api/payments/ifthenpay/callback?key=[ANTI_PHISHING_KEY]&orderId=[ORDER_ID]&amount=[AMOUNT]&requestId=[REQUEST_ID]&payment_datetime=[PAYMENT_DATETIME]
 * (cartão: o parâmetro chama-se "id" em vez de "orderId").
 * Responder 200 apenas quando processado; outro código faz a ifthenpay repetir.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const ip = await clientIp();
  if (!validCallbackKey(q.get("key"), ifthenpayConfig().antiPhishingKey)) {
    await audit({ actorType: "SYSTEM", action: "payment.callback_rejected", entityType: "Payment", entityId: "-", ip, meta: { reason: "anti_phishing" } });
    return new Response("forbidden", { status: 403 });
  }
  const orderId = q.get("orderId") ?? q.get("id");
  const requestId = q.get("requestId");
  const payment =
    (orderId && (await db.payment.findUnique({ where: { providerRef: orderId } }))) ||
    (requestId && (await db.payment.findUnique({ where: { providerRequestId: requestId } }))) ||
    null;
  // Pagamento desconhecido: 200 para não gerar repetições inúteis, mas fica registado.
  if (!payment || payment.provider !== "ifthenpay") {
    await audit({ actorType: "SYSTEM", action: "payment.callback_unknown", entityType: "Payment", entityId: orderId ?? "-", ip, meta: Object.fromEntries(q) });
    return new Response("ok");
  }
  if (!amountMatches(q.get("amount"), payment.amountCents)) {
    await audit({ actorType: "SYSTEM", action: "payment.callback_amount_mismatch", entityType: "Case", entityId: payment.caseId, ip, meta: { expected: payment.amountCents, received: q.get("amount") } });
    return new Response("ok");
  }
  const meta = Object.fromEntries([...q.entries()].filter(([k]) => k !== "key"));
  await handlePaymentEvent({ providerRef: payment.providerRef, status: "CONFIRMED", raw: { source: "callback", ...meta } });
  return new Response("ok");
}
