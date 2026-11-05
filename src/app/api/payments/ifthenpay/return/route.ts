import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/modules/crypto";
import { handlePaymentEvent } from "@/modules/cases/service";
import { ifthenpayConfig } from "@/modules/payments";
import { ifthenpaySignature } from "@/modules/payments/ifthenpay";
import { PAYMENT_RETURN_COOKIE as RETURN_COOKIE } from "@/modules/payments/types";

/**
 * Regresso do cliente após pagamento por cartão. Em caso de sucesso a ifthenpay acrescenta
 * id, amount, requestId e sk = HMAC-SHA256(id + amount + requestId, CCARD Key).
 * Uma assinatura válida confirma o pagamento; o callback servidor-a-servidor confirma também (idempotente).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const jar = await cookies();
  const token = jar.get(RETURN_COOKIE)?.value;
  const back = token ? `${env.appUrl}/p/${token}` : `${env.appUrl}/pagamento/concluido`;

  const id = q.get("id") ?? "";
  const payment = id ? await db.payment.findUnique({ where: { providerRef: id } }) : null;
  const { ccardKey } = ifthenpayConfig();

  if (payment && payment.status === "PENDING") {
    if (q.get("result") === "success") {
      const sk = q.get("sk") ?? "";
      const amount = q.get("amount") ?? "";
      const requestId = q.get("requestId") ?? "";
      const valid =
        !!ccardKey &&
        requestId === payment.providerRequestId &&
        safeEqual(sk, ifthenpaySignature(id, amount, requestId, ccardKey)) &&
        Math.round(Number(amount) * 100) === payment.amountCents;
      if (valid) await handlePaymentEvent({ providerRef: id, status: "CONFIRMED", raw: { source: "return", id, amount, requestId } });
    } else {
      await handlePaymentEvent({ providerRef: id, status: "FAILED", raw: { source: "return", result: q.get("result") } });
    }
  }
  jar.delete(RETURN_COOKIE);
  return NextResponse.redirect(back, 303);
}
