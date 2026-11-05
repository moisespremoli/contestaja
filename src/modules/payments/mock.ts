import { hmac, safeEqual } from "@/modules/crypto";
import type { PaymentProvider, WebhookEvent } from "./types";

/**
 * Provider de DESENVOLVIMENTO. Simula MB WAY, Multibanco e cartão.
 * A confirmação chega por webhook assinado (HMAC) — tal como num gateway real —
 * disparado pela página de simulação /dev/pagamento/[ref]. Desativado em produção.
 */
export function mockProvider(): PaymentProvider {
  return {
    name: "mock",
    methods: ["MBWAY", "CARD", "MULTIBANCO"],
    async create(input) {
      const sim = `/dev/pagamento/${input.orderId}`;
      switch (input.method) {
        case "MULTIBANCO":
          return {
            instructions: {
              entity: "12345",
              reference: String(Math.floor(100_000_000 + Math.random() * 899_999_999)).replace(/(\d{3})(?=\d)/g, "$1 "),
              expiresAt: new Date(Date.now() + 3 * 864e5).toISOString(),
              redirectUrl: sim,
              message: "Pague no Multibanco ou homebanking com a entidade e referência indicadas.",
            },
          };
        case "MBWAY":
          return {
            instructions: {
              phoneMasked: input.phone ? `*** *** ${input.phone.slice(-3)}` : undefined,
              redirectUrl: sim,
              message: "Aceite o pedido de pagamento na aplicação MB WAY (válido durante 4 minutos).",
            },
          };
        case "CARD":
          return { instructions: { redirectUrl: sim, message: "Será redirecionado para a página segura de pagamento." } };
      }
    },
  };
}

/** Valida o webhook do simulador. */
export function parseMockWebhook(secret: string, body: string, headers: Headers): WebhookEvent | null {
  const sig = headers.get("x-signature") ?? "";
  if (!safeEqual(sig, hmac(secret, body))) return null;
  const data = JSON.parse(body) as { providerRef: string; status: "CONFIRMED" | "FAILED" | "EXPIRED" };
  return { providerRef: data.providerRef, status: data.status, raw: data };
}
