import type { CaseStatus } from "@/generated/prisma/enums";

export const STATUS_LABELS: Record<CaseStatus, string> = {
  FORM_STARTED: "Formulário iniciado",
  FORM_COMPLETED: "Formulário concluído",
  AWAITING_PAYMENT: "A aguardar pagamento",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  AWAITING_REVIEW: "A aguardar revisão",
  DOCUMENT_GENERATED: "Documento gerado",
  DELIVERED: "Entregue ao cliente",
  REJECTED_NO_TEMPLATE: "Rejeitado / sem minuta adequada",
};
