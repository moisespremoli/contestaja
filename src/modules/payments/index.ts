import "server-only";
import { env } from "@/lib/env";
import { ifthenpayProvider } from "./ifthenpay";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";

export function ifthenpayConfig() {
  return {
    mbKey: process.env.IFTHENPAY_MB_KEY || undefined,
    mbwayKey: process.env.IFTHENPAY_MBWAY_KEY || undefined,
    ccardKey: process.env.IFTHENPAY_CCARD_KEY || undefined,
    antiPhishingKey: process.env.IFTHENPAY_ANTI_PHISHING_KEY ?? "",
    sandbox: process.env.IFTHENPAY_SANDBOX !== "false",
    mbExpiryDays: Number(process.env.IFTHENPAY_MB_EXPIRY_DAYS ?? "3"),
  };
}

export function getPaymentProvider(): PaymentProvider {
  switch (env.paymentProvider) {
    case "mock":
      if (!env.mockPaymentsEnabled) {
        throw new Error("O provider de pagamentos 'mock' não pode ser usado em produção.");
      }
      return mockProvider();
    case "ifthenpay": {
      const cfg = ifthenpayConfig();
      if (!cfg.antiPhishingKey) throw new Error("IFTHENPAY_ANTI_PHISHING_KEY não definida");
      return ifthenpayProvider(cfg);
    }
    default:
      throw new Error(`Provider de pagamentos desconhecido: ${env.paymentProvider}`);
  }
}

export const METHOD_LABELS = { MBWAY: "MB WAY", CARD: "Cartão bancário", MULTIBANCO: "Referência Multibanco", COUPON: "Código promocional" } as const;
