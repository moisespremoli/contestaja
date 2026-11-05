export type Method = "MBWAY" | "CARD" | "MULTIBANCO";

export interface CreatePaymentInput {
  caseId: string;
  caseReference: string;
  amountCents: number;
  method: Method;
  phone?: string;
  email: string;
  returnUrl: string;
}

export interface CreatedPayment {
  providerRef: string;
  /** Dados a mostrar ao cliente. */
  instructions: {
    entity?: string;
    reference?: string;
    expiresAt?: string;
    phoneMasked?: string;
    redirectUrl?: string;
    message: string;
  };
}

export interface WebhookEvent {
  providerRef: string;
  status: "CONFIRMED" | "FAILED" | "EXPIRED";
  raw: unknown;
}

/**
 * Interface comum a todos os gateways (easypay, ifthenpay, Eupago, SIBS…).
 * O documento só é libertado após `parseWebhook` devolver CONFIRMED com assinatura válida.
 */
export interface PaymentProvider {
  name: string;
  create(input: CreatePaymentInput): Promise<CreatedPayment>;
  /** Valida a autenticidade do pedido e devolve o evento normalizado (ou null se inválido). */
  parseWebhook(body: string, headers: Headers): Promise<WebhookEvent | null>;
}
