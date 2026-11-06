import type { CaseData } from "./schema";
import { DOC_TIPOS, ENTIDADES_AUTUANTES, MEIOS_DETECAO, TIPOS_VIA } from "./schema";

/**
 * Papel do requerente face ao veículo/infração — base da verificação de legitimidade.
 */
export type ApplicantRole = "TITULAR_E_CONDUTOR" | "TITULAR" | "CONDUTOR" | "SEM_LEGITIMIDADE_APARENTE";

export function applicantRole(d: CaseData): ApplicantRole {
  const isTitular = d.titular.e_requerente;
  const isCondutor = d.requerente.tipo === "SINGULAR" && d.condutor.identificacao === "REQUERENTE";
  if (isTitular && isCondutor) return "TITULAR_E_CONDUTOR";
  if (isTitular) return "TITULAR";
  if (isCondutor) return "CONDUTOR";
  return "SEM_LEGITIMIDADE_APARENTE";
}

/** Soma dias úteis (seg–sex). Não considera feriados: o resultado é apenas indicativo. */
export function addBusinessDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

export interface DeriveOptions {
  today?: string;
  defenseDeadlineDays?: number | null;
}

/**
 * Contexto completo usado pelo motor de seleção e pelo preenchimento:
 * dados do formulário + valores calculados (calc.*) + indicadores booleanos (flags.*).
 * Nenhum valor jurídico é inventado aqui — apenas derivações factuais dos dados.
 */
export function buildContext(d: CaseData, opts: DeriveOptions = {}) {
  const r = d.requerente;
  const role = applicantRole(d);
  const nomeRequerente = r.tipo === "SINGULAR" ? r.nome : r.denominacao;
  const condutorNome =
    d.condutor.identificacao === "REQUERENTE" && r.tipo === "SINGULAR"
      ? r.nome
      : d.condutor.identificacao === "REPRESENTANTE"
        ? d.representante?.nome
        : d.condutor.nome;
  const titularNome = d.titular.e_requerente ? nomeRequerente : d.titular.nome;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const excesso = d.infracao.velocidade_considerada - d.infracao.velocidade_maxima;
  const entidade =
    d.infracao.entidade_autuante === "OUTRA"
      ? (d.infracao.entidade_autuante_outra ?? "")
      : ENTIDADES_AUTUANTES[d.infracao.entidade_autuante];

  return {
    ...d,
    requerente: {
      ...r,
      nome_ou_denominacao: nomeRequerente,
      papel: role,
      doc_tipo_extenso: r.tipo === "SINGULAR" ? DOC_TIPOS[r.doc_tipo] : undefined,
      morada_completa: `${r.morada}, ${r.codigo_postal} ${r.localidade}`,
    },
    titular: { ...d.titular, nome_efetivo: titularNome },
    condutor: {
      ...d.condutor,
      nome_efetivo: condutorNome,
      doc_tipo_extenso: d.condutor.doc_tipo ? DOC_TIPOS[d.condutor.doc_tipo] : undefined,
    },
    infracao: {
      ...d.infracao,
      entidade_autuante_extenso: entidade,
      tipo_via_extenso: TIPOS_VIA[d.infracao.tipo_via],
      meio_detecao_extenso: MEIOS_DETECAO[d.infracao.meio_detecao],
    },
    calc: {
      data_hoje: today,
      excesso_velocidade: excesso,
      prazo_indicativo:
        opts.defenseDeadlineDays && d.infracao.data_rececao
          ? addBusinessDays(d.infracao.data_rececao, opts.defenseDeadlineDays)
          : undefined,
    },
    flags: {
      pessoa_singular: r.tipo === "SINGULAR",
      pessoa_coletiva: r.tipo === "COLETIVA",
      tem_representante: r.tipo === "COLETIVA" && !!d.representante,
      requerente_e_titular: d.titular.e_requerente,
      requerente_e_condutor: role === "TITULAR_E_CONDUTOR" || role === "CONDUTOR",
      titular_diferente: !d.titular.e_requerente,
      condutor_identificado: d.condutor.identificacao !== "NAO_IDENTIFICADO",
      condutor_terceiro: d.condutor.identificacao === "OUTRA_PESSOA",
      condutor_representante: d.condutor.identificacao === "REPRESENTANTE",
      condutor_nao_identificado: d.condutor.identificacao === "NAO_IDENTIFICADO",
      tem_hora: !!d.infracao.hora,
      tem_velocidade_registada: d.infracao.velocidade_registada !== undefined,
      tem_data_notificacao: !!d.infracao.data_notificacao,
      tem_descricao: !!d.adicional?.descricao,
      tem_observacoes: !!d.adicional?.observacoes,
      defesa_tem_normas: !!d.defesa?.normas_infringidas,
      defesa_foto_ilegivel: !!d.defesa?.foto_ilegivel,
      defesa_tem_equipamento: !!d.defesa?.auto_equipamento,
      defesa_tem_data_verificacao: !!d.defesa?.data_ultima_verificacao,
      defesa_sem_antecedentes: !!d.defesa?.sem_antecedentes,
      defesa_tem_anos_carta: d.defesa?.anos_carta != null,
      defesa_boas_condicoes: !!d.defesa?.boas_condicoes,
      defesa_nao_pagou: !!d.defesa?.nao_pagou,
      defesa_pede_dispensa_sancao: !!d.defesa?.pede_dispensa_sancao,
      defesa_unico_condutor_agregado: !!d.defesa?.unico_condutor_agregado,
      defesa_tem_necessidade_carta: !!d.defesa?.necessidade_carta,
    },
  };
}

export type CaseContext = ReturnType<typeof buildContext>;
