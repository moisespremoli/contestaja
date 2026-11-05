import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeEqual } from "@/modules/crypto";
import { handlePaymentEvent } from "@/modules/cases/service";
import { ifthenpayConfig } from "@/modules/payments";
import { ifthenpaySignature, mbwayStatusToEvent, toAmount } from "@/modules/payments/ifthenpay";

/**
 * Notificação MB WAY (POST JSON) com o estado final do pedido (pago, recusado, expirado).
 * Assinatura: X-Ifthenpay-Signature = HMAC-SHA256(orderId + amount + requestId, MB WAY Key).
 */
export async function POST(req: Request) {
  const { mbwayKey } = ifthenpayConfig();
  let body: { RequestId?: string; Status?: string; Message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  if (!mbwayKey || !body.RequestId) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
  const payment = await db.payment.findUnique({ where: { providerRequestId: body.RequestId } });
  if (!payment) return NextResponse.json({ error: "desconhecido" }, { status: 404 });

  const expected = ifthenpaySignature(payment.providerRef, toAmount(payment.amountCents), body.RequestId, mbwayKey);
  if (!safeEqual(req.headers.get("x-ifthenpay-signature") ?? "", expected)) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }
  const status = mbwayStatusToEvent(body.Status ?? "");
  if (status) await handlePaymentEvent({ providerRef: payment.providerRef, status, raw: { source: "notification", ...body } });
  return NextResponse.json({ ok: true });
}
