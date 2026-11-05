import { NextResponse } from "next/server";
import { handlePaymentEvent } from "@/modules/cases/service";
import { getPaymentProvider } from "@/modules/payments";

/** Webhook do gateway de pagamentos. Única via para confirmar um pagamento. */
export async function POST(req: Request) {
  const body = await req.text();
  const provider = getPaymentProvider();
  const event = await provider.parseWebhook(body, req.headers);
  if (!event) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  const result = await handlePaymentEvent(event);
  if (!result.ok) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
