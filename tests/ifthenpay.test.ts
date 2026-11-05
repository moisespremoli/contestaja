import { describe, expect, it } from "vitest";
import {
  amountMatches,
  ifthenpayProvider,
  ifthenpaySignature,
  mbwayStatusToEvent,
  validCallbackKey,
} from "@/modules/payments/ifthenpay";
import type { CreatePaymentInput } from "@/modules/payments/types";

function stubFetch(response: unknown) {
  const calls: { url: string; body?: unknown }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(response), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const input = (over: Partial<CreatePaymentInput> = {}): CreatePaymentInput => ({
  caseId: "c1",
  caseReference: "CJ-2026-ABCDEF",
  orderId: "CJabc123def456g",
  amountCents: 2900,
  method: "MULTIBANCO",
  phone: "912345678",
  email: "cliente@example.com",
  clientName: "Cliente Teste",
  returnUrls: { success: "https://x/s", error: "https://x/e", cancel: "https://x/c" },
  notificationUrl: "https://x/n",
  ...over,
});

const cfg = { mbKey: "MB-KEY", mbwayKey: "MBW-KEY", ccardKey: "CC-KEY", antiPhishingKey: "apk", sandbox: true, mbExpiryDays: 3 };

describe("ifthenpay", () => {
  it("assinatura coincide com o exemplo oficial da documentação", () => {
    expect(ifthenpaySignature("order_45678", "11.55", "36jvlEhUYeknQ8PHKprR", "AAA-000000")).toBe(
      "d7d2fd272233f0102e6dd0e50969025481cdfe3abb87cc3f135f74cfb47b2561",
    );
  });

  it("gera referência Multibanco no sandbox", async () => {
    const { fn, calls } = stubFetch({ Status: "0", Message: "Success", Entity: "11990", Reference: "000000291", ExpiryDate: "08-11-2026", RequestId: "RQ1" });
    const r = await ifthenpayProvider({ ...cfg, fetch: fn }).create(input());
    expect(calls[0].url).toBe("https://api.ifthenpay.com/multibanco/reference/sandbox");
    expect(calls[0].body).toMatchObject({ mbKey: "MB-KEY", orderId: "CJabc123def456g", amount: "29.00", expiryDays: 3 });
    expect(r.providerRequestId).toBe("RQ1");
    expect(r.instructions.reference).toBe("000 000 291");
  });

  it("pede MB WAY com o formato 351#telemóvel", async () => {
    const { fn, calls } = stubFetch({ Status: "000", Message: "Pending", RequestId: "RQ2" });
    await ifthenpayProvider({ ...cfg, fetch: fn }).create(input({ method: "MBWAY" }));
    expect(calls[0].url).toBe("https://api.ifthenpay.com/spg/payment/mbway");
    expect(calls[0].body).toMatchObject({ mbWayKey: "MBW-KEY", mobileNumber: "351#912345678", amount: "29.00", notificationUrl: "https://x/n" });
  });

  it("recusa MB WAY com estado diferente de 000", async () => {
    const { fn } = stubFetch({ Status: "122", Message: "Declined" });
    await expect(ifthenpayProvider({ ...cfg, fetch: fn }).create(input({ method: "MBWAY" }))).rejects.toThrow(/recusado/);
  });

  it("inicia pagamento por cartão e devolve o URL de pagamento", async () => {
    const { fn, calls } = stubFetch({ Status: "0", Message: "Success", PaymentUrl: "https://pay.ifthenpay.com/?t=x", RequestId: "RQ3" });
    const r = await ifthenpayProvider({ ...cfg, sandbox: false, fetch: fn }).create(input({ method: "CARD" }));
    expect(calls[0].url).toBe("https://api.ifthenpay.com/creditcard/init/CC-KEY");
    expect(calls[0].body).toMatchObject({ successUrl: "https://x/s", errorUrl: "https://x/e", cancelUrl: "https://x/c", language: "pt" });
    expect(r.instructions.redirectUrl).toBe("https://pay.ifthenpay.com/?t=x");
  });

  it("só disponibiliza métodos com chave configurada", () => {
    expect(ifthenpayProvider({ antiPhishingKey: "k", sandbox: true, mbExpiryDays: 3, mbwayKey: "x" }).methods).toEqual(["MBWAY"]);
  });

  it("mapeia estados MB WAY e valida callback", () => {
    expect(mbwayStatusToEvent("000")).toBe("CONFIRMED");
    expect(mbwayStatusToEvent("020")).toBe("FAILED");
    expect(mbwayStatusToEvent("101")).toBe("EXPIRED");
    expect(mbwayStatusToEvent("999")).toBeNull();
    expect(validCallbackKey("apk", "apk")).toBe(true);
    expect(validCallbackKey("x", "apk")).toBe(false);
    expect(validCallbackKey(null, "apk")).toBe(false);
    expect(amountMatches("29.00", 2900)).toBe(true);
    expect(amountMatches("29", 2900)).toBe(true);
    expect(amountMatches("28.99", 2900)).toBe(false);
  });
});
