import "server-only";
import { env } from "@/lib/env";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  switch (env.paymentProvider) {
    case "mock":
      if (env.isProduction && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
        throw new Error("O provider de pagamentos 'mock' não pode ser usado em produção.");
      }
      return mockProvider(env.paymentWebhookSecret);
    // case "easypay": return easypayProvider(...)   — Fase 5
    // case "ifthenpay": return ifthenpayProvider(...)
    default:
      throw new Error(`Provider de pagamentos desconhecido: ${env.paymentProvider}`);
  }
}

export const METHOD_LABELS = { MBWAY: "MB WAY", CARD: "Cartão bancário", MULTIBANCO: "Referência Multibanco" } as const;
