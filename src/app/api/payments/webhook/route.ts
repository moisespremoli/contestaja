import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { handlePaymentEvent } from "@/modules/cases/service";
import { parseMockWebhook } from "@/modules/payments/mock";

/** Webhook do simulador de pagamentos (apenas PAYMENT_PROVIDER=mock). */
export async function POST(req: Request) {
  if (env.paymentProvider !== "mock") return NextResponse.json({ error: "indisponível" }, { status: 404 });
  const body = await req.text();
  const event = parseMockWebhook(env.paymentWebhookSecret, body, req.headers);
  if (!event) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  const result = await handlePaymentEvent(event);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
