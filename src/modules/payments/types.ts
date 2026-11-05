/** Cookie com o token do processo, para devolver o cliente à sua área após o pagamento por cartão. */
export const PAYMENT_RETURN_COOKIE = "cj_pay_return";

export type Method = "MBWAY" | "CARD" | "MULTIBANCO";

export interface CreatePaymentInput {
  caseId: string;
  caseReference: string;
  /** Identificador único deste pagamento do nosso lado (máx. 15 caracteres — limite MB WAY/cartão). */
  orderId: string;
  amountCents: number;
  method: Method;
  phone?: string;
  email: string;
  clientName: string;
  /** URLs absolutas para onde o gateway devolve o cliente (cartão). */
  returnUrls: { success: string; error: string; cancel: string };
  /** URL absoluta de notificação de estado (MB WAY ifthenpay). */
  notificationUrl: string;
}

export interface CreatedPayment {
  /** Token do gateway (ex.: RequestId). */
  providerRequestId?: string;
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
 * Interface comum a todos os gateways (ifthenpay, easypay, Eupago, SIBS…).
 * O documento só é libertado após um evento CONFIRMED autenticado.
 */
export interface PaymentProvider {
  name: string;
  /** Métodos ativos (dependem das chaves configuradas). */
  methods: Method[];
  create(input: CreatePaymentInput): Promise<CreatedPayment>;
  /** Consulta ativa do estado (para gateways/métodos que o permitem). */
  checkStatus?(payment: { method: Method; providerRef: string; providerRequestId: string | null }): Promise<WebhookEvent | null>;
}
