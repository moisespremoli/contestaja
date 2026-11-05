import { createHmac } from "node:crypto";
import { safeEqual } from "@/modules/crypto";
import type { Method, PaymentProvider, WebhookEvent } from "./types";

/**
 * Gateway ifthenpay (https://ifthenpay.com/docs/en/).
 *  - Multibanco: POST https://api.ifthenpay.com/multibanco/reference/{init|sandbox}
 *  - MB WAY:     POST https://api.ifthenpay.com/spg/payment/mbway  (+ GET /mbway/status)
 *  - Cartão:     POST https://api.ifthenpay.com/creditcard/{init|sandbox/init}/{CCARD_KEY}
 * Confirmação: callback GET com chave anti-phishing (todos os métodos), notificação MB WAY
 * assinada (HMAC-SHA256 com a MB WAY Key) e regresso do cartão com assinatura "sk".
 */

export interface IfthenpayConfig {
  mbKey?: string;
  mbwayKey?: string;
  ccardKey?: string;
  antiPhishingKey: string;
  sandbox: boolean;
  mbExpiryDays: number;
  baseUrl?: string;
  fetch?: typeof fetch;
}

const API = "https://api.ifthenpay.com";

export const toAmount = (cents: number) => (cents / 100).toFixed(2);

/** Assinatura ifthenpay: HMAC-SHA256(orderId + amount + requestId, chave). */
export function ifthenpaySignature(orderId: string, amount: string, requestId: string, key: string) {
  return createHmac("sha256", key).update(`${orderId}${amount}${requestId}`).digest("hex");
}

export function mbwayStatusToEvent(status: string): WebhookEvent["status"] | null {
  if (status === "000") return "CONFIRMED";
  if (status === "020" || status === "122") return "FAILED";
  if (status === "101") return "EXPIRED";
  return null;
}

export function ifthenpayProvider(cfg: IfthenpayConfig): PaymentProvider {
  const base = cfg.baseUrl ?? API;
  const http = cfg.fetch ?? fetch;
  const methods: Method[] = [];
  if (cfg.mbwayKey) methods.push("MBWAY");
  if (cfg.ccardKey) methods.push("CARD");
  if (cfg.mbKey) methods.push("MULTIBANCO");

  async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await http(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`ifthenpay respondeu HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    name: "ifthenpay",
    methods,

    async create(input) {
      const amount = toAmount(input.amountCents);
      const description = `ContestaJá ${input.caseReference}`;

      if (input.method === "MULTIBANCO") {
        if (!cfg.mbKey) throw new Error("Multibanco indisponível");
        const r = await post<{ Status: string; Message: string; Entity: string; Reference: string; ExpiryDate?: string; RequestId: string }>(
          `${base}/multibanco/reference/${cfg.sandbox ? "sandbox" : "init"}`,
          {
            mbKey: cfg.mbKey,
            orderId: input.orderId,
            amount,
            description,
            clientName: input.clientName.slice(0, 200),
            clientEmail: input.email.slice(0, 200),
            expiryDays: cfg.mbExpiryDays,
          },
        );
        if (r.Status !== "0") throw new Error(`Não foi possível gerar a referência Multibanco (${r.Message})`);
        return {
          providerRequestId: r.RequestId,
          instructions: {
            entity: r.Entity,
            reference: r.Reference.replace(/(\d{3})(?=\d)/g, "$1 "),
            expiresAt: r.ExpiryDate,
            message: "Pague no Multibanco ou homebanking (Pagamento de Serviços) com a entidade e referência indicadas.",
          },
        };
      }

      if (input.method === "MBWAY") {
        if (!cfg.mbwayKey) throw new Error("MB WAY indisponível");
        if (!input.phone) throw new Error("Número MB WAY em falta");
        const r = await post<{ Status: string; Message: string; RequestId: string }>(`${base}/spg/payment/mbway`, {
          mbWayKey: cfg.mbwayKey,
          orderId: input.orderId,
          amount,
          mobileNumber: `351#${input.phone}`,
          email: input.email.slice(0, 100),
          description: description.slice(0, 100),
          notificationUrl: input.notificationUrl,
        });
        if (r.Status !== "000") throw new Error(`Pedido MB WAY recusado (${r.Message}). Verifique o número e tente novamente.`);
        return {
          providerRequestId: r.RequestId,
          instructions: {
            phoneMasked: `*** *** ${input.phone.slice(-3)}`,
            message: "Aceite o pedido de pagamento na aplicação MB WAY. Tem 4 minutos para o fazer.",
          },
        };
      }

      if (!cfg.ccardKey) throw new Error("Pagamento por cartão indisponível");
      const r = await post<{ Status: string; Message: string; PaymentUrl: string; RequestId: string }>(
        `${base}/creditcard/${cfg.sandbox ? "sandbox/init" : "init"}/${encodeURIComponent(cfg.ccardKey)}`,
        {
          orderId: input.orderId,
          amount,
          successUrl: input.returnUrls.success,
          errorUrl: input.returnUrls.error,
          cancelUrl: input.returnUrls.cancel,
          language: "pt",
        },
      );
      if (r.Status !== "0" || !r.PaymentUrl) throw new Error(`Não foi possível iniciar o pagamento por cartão (${r.Message})`);
      return {
        providerRequestId: r.RequestId,
        instructions: { redirectUrl: r.PaymentUrl, message: "Será redirecionado para a página segura de pagamento ifthenpay." },
      };
    },

    async checkStatus(p) {
      if (p.method !== "MBWAY" || !cfg.mbwayKey || !p.providerRequestId) return null;
      const url = `${base}/spg/payment/mbway/status?mbWayKey=${encodeURIComponent(cfg.mbwayKey)}&requestId=${encodeURIComponent(p.providerRequestId)}`;
      const res = await http(url, { headers: { accept: "application/json" } });
      if (!res.ok) return null;
      const r = (await res.json()) as { Status: string; Message: string };
      const status = mbwayStatusToEvent(r.Status);
      return status ? { providerRef: p.providerRef, status, raw: { source: "status", ...r } } : null;
    },
  };
}

/** Valida a chave anti-phishing do callback. */
export function validCallbackKey(received: string | null, expected: string) {
  return !!received && !!expected && safeEqual(received, expected);
}

/** Compara o valor recebido do gateway com o valor esperado. */
export function amountMatches(received: string | null, cents: number) {
  if (!received) return false;
  return Math.round(Number(received.replace(",", ".")) * 100) === cents;
}
