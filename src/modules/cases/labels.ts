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

/** Designação pública do tipo de documento (Template.processType). */
export const PROCESS_TYPE_LABELS: Record<string, { title: string; description: string }> = {
  DEFESA_ESCRITA: {
    title: "Defesa escrita (contestação)",
    description: "Documento de defesa relativo ao auto de contraordenação.",
  },
  IDENTIFICACAO_CONDUTOR: {
    title: "Identificação do condutor",
    description:
      "Como indicou que não era o condutor, o documento aplicável é a identificação do condutor à entidade autuante, para que o processo prossiga contra quem conduzia.",
  },
};
