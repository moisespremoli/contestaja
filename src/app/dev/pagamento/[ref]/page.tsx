import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hmac } from "@/modules/crypto";

export const dynamic = "force-dynamic";

/**
 * SIMULADOR DO GATEWAY (apenas com PAYMENT_PROVIDER=mock e fora de produção).
 * Envia ao webhook um evento assinado, exatamente como faria um gateway real.
 */
async function simulate(ref: string, status: "CONFIRMED" | "FAILED", back: string) {
  "use server";
  if (env.isProduction || env.paymentProvider !== "mock") throw new Error("Indisponível");
  const body = JSON.stringify({ providerRef: ref, status });
  await fetch(`${env.appUrl}/api/payments/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": hmac(env.paymentWebhookSecret, body) },
    body,
  });
  redirect(back);
}

export default async function DevPayment({ params, searchParams }: PageProps<"/dev/pagamento/[ref]">) {
  if (env.isProduction || env.paymentProvider !== "mock") notFound();
  const { ref } = await params;
  const { back } = await searchParams;
  const payment = await db.payment.findUnique({ where: { providerRef: ref }, include: { case: true } });
  if (!payment) notFound();
  const backUrl = typeof back === "string" && back.startsWith("/") ? back : "/";

  return (
    <main className="mx-auto max-w-md flex-1 px-4 py-16">
      <div className="card space-y-5 p-6">
        <p className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">SIMULADOR DE GATEWAY — DESENVOLVIMENTO</p>
        <h1 className="text-xl font-semibold">Pagamento {payment.method}</h1>
        <p className="text-sm text-ink-600">
          Processo {payment.case.reference} · {(payment.amountCents / 100).toFixed(2)} € · estado atual: {payment.status}
        </p>
        <form className="flex gap-3">
          <button formAction={simulate.bind(null, ref, "CONFIRMED", backUrl)} className="btn btn-accent">
            Confirmar pagamento
          </button>
          <button formAction={simulate.bind(null, ref, "FAILED", backUrl)} className="btn btn-ghost">
            Recusar
          </button>
        </form>
      </div>
    </main>
  );
}
