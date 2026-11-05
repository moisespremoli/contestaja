import { evaluateConditions } from "./conditions";

/**
 * Motor de seleção de minutas — função pura e determinística.
 *
 * Regras fundamentais:
 *  1. Só minutas ATIVAS, com versão corrente, da MESMA categoria e do MESMO tipo de requerente.
 *     Nunca há recurso a uma minuta de outro tipo de requerente.
 *  2. O requerente tem de ter legitimidade aparente (titular ou condutor; pessoa coletiva com representante).
 *  3. As condições de utilização da minuta têm de ser satisfeitas.
 *  4. Desempate por prioridade; empate no topo => análise manual (nunca escolha arbitrária).
 *  5. Sem minuta compatível => nenhuma contestação genérica é gerada.
 */

export interface CandidateTemplate {
  id: string;
  code: string;
  internalName: string;
  categoryCode: string;
  applicantType: "SINGULAR" | "COLETIVA";
  status: "ACTIVE" | "INACTIVE";
  priority: number;
  conditions: unknown;
  currentVersionId: string | null;
}

export interface SelectionInput {
  categoryCode: string;
  applicantType: "SINGULAR" | "COLETIVA";
  /** Contexto derivado (buildContext) — usado nas condições. */
  context: {
    requerente: { papel: string };
    flags: { tem_representante: boolean; pessoa_coletiva: boolean };
  } & Record<string, unknown>;
}

export type SelectionOutcome = "SELECTED" | "NO_TEMPLATE" | "AMBIGUOUS" | "LEGITIMACY_ISSUE";

export interface TraceEntry {
  templateId: string;
  code: string;
  eligible: boolean;
  reasons: string[];
}

export interface SelectionResult {
  outcome: SelectionOutcome;
  templateId?: string;
  templateVersionId?: string;
  message: string;
  trace: TraceEntry[];
  evaluatedAt: string;
}

export function checkLegitimacy(input: SelectionInput): string[] {
  const issues: string[] = [];
  if (input.context.requerente.papel === "SEM_LEGITIMIDADE_APARENTE") {
    issues.push("O requerente não é o titular do veículo nem o condutor identificado.");
  }
  if (input.applicantType === "COLETIVA" && !input.context.flags.tem_representante) {
    issues.push("Pessoa coletiva sem representante legal identificado.");
  }
  return issues;
}

export function selectTemplate(input: SelectionInput, templates: CandidateTemplate[]): SelectionResult {
  const evaluatedAt = new Date().toISOString();
  const legitimacy = checkLegitimacy(input);
  if (legitimacy.length > 0) {
    return {
      outcome: "LEGITIMACY_ISSUE",
      message: legitimacy.join(" "),
      trace: [],
      evaluatedAt,
    };
  }

  const trace: TraceEntry[] = templates.map((t) => {
    const reasons: string[] = [];
    if (t.categoryCode !== input.categoryCode) reasons.push(`categoria ${t.categoryCode} ≠ ${input.categoryCode}`);
    if (t.applicantType !== input.applicantType) reasons.push(`destinada a ${t.applicantType}, processo é ${input.applicantType}`);
    if (t.status !== "ACTIVE") reasons.push("minuta inativa");
    if (!t.currentVersionId) reasons.push("sem versão DOCX carregada");
    if (reasons.length === 0) {
      const cond = evaluateConditions(t.conditions, input.context);
      reasons.push(...cond.failed.map((f) => `condição não cumprida: ${f}`));
    }
    return { templateId: t.id, code: t.code, eligible: reasons.length === 0, reasons };
  });

  const eligible = templates.filter((t) => trace.find((e) => e.templateId === t.id)?.eligible);
  if (eligible.length === 0) {
    return {
      outcome: "NO_TEMPLATE",
      message: "Não existe uma minuta aprovada compatível com as características deste processo.",
      trace,
      evaluatedAt,
    };
  }

  const top = Math.max(...eligible.map((t) => t.priority));
  const best = eligible.filter((t) => t.priority === top);
  if (best.length > 1) {
    return {
      outcome: "AMBIGUOUS",
      message: `Várias minutas compatíveis com a mesma prioridade (${best.map((b) => b.code).join(", ")}). Requer análise manual.`,
      trace,
      evaluatedAt,
    };
  }

  const chosen = best[0];
  return {
    outcome: "SELECTED",
    templateId: chosen.id,
    templateVersionId: chosen.currentVersionId!,
    message: `Minuta ${chosen.code} selecionada.`,
    trace,
    evaluatedAt,
  };
}
