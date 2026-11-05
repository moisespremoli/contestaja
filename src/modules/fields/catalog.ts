/**
 * Catálogo de campos da plataforma disponíveis para mapeamento nas minutas.
 * O administrador associa cada {{MARCADOR}} de uma minuta a um destes caminhos,
 * sem alterar código. Novos campos são acrescentados aqui.
 */
export type FieldType = "text" | "date" | "time" | "number" | "boolean" | "nif" | "email" | "phone";

export interface CatalogField {
  path: string;
  label: string;
  type: FieldType;
  group: string;
  applies?: "SINGULAR" | "COLETIVA";
}

export const FIELD_CATALOG: CatalogField[] = [
  // Requerente
  { path: "requerente.nome_ou_denominacao", label: "Nome / denominação do requerente", type: "text", group: "Requerente" },
  { path: "requerente.nome", label: "Nome completo", type: "text", group: "Requerente", applies: "SINGULAR" },
  { path: "requerente.nif", label: "NIF", type: "nif", group: "Requerente", applies: "SINGULAR" },
  { path: "requerente.doc_tipo_extenso", label: "Tipo de documento de identificação", type: "text", group: "Requerente", applies: "SINGULAR" },
  { path: "requerente.doc_numero", label: "N.º do documento de identificação", type: "text", group: "Requerente", applies: "SINGULAR" },
  { path: "requerente.doc_validade", label: "Validade do documento", type: "date", group: "Requerente", applies: "SINGULAR" },
  { path: "requerente.doc_emitente", label: "Entidade emissora do documento", type: "text", group: "Requerente", applies: "SINGULAR" },
  { path: "requerente.denominacao", label: "Denominação social", type: "text", group: "Requerente", applies: "COLETIVA" },
  { path: "requerente.nipc", label: "NIPC", type: "nif", group: "Requerente", applies: "COLETIVA" },
  { path: "requerente.morada", label: "Morada / sede", type: "text", group: "Requerente" },
  { path: "requerente.codigo_postal", label: "Código postal", type: "text", group: "Requerente" },
  { path: "requerente.localidade", label: "Localidade", type: "text", group: "Requerente" },
  { path: "requerente.morada_completa", label: "Morada completa (morada, CP, localidade)", type: "text", group: "Requerente" },
  { path: "requerente.email", label: "Email", type: "email", group: "Requerente" },
  { path: "requerente.telefone", label: "Telefone", type: "phone", group: "Requerente" },
  // Representante
  { path: "representante.nome", label: "Nome do representante legal", type: "text", group: "Representante", applies: "COLETIVA" },
  { path: "representante.nif", label: "NIF do representante", type: "nif", group: "Representante", applies: "COLETIVA" },
  { path: "representante.cargo", label: "Cargo / qualidade", type: "text", group: "Representante", applies: "COLETIVA" },
  { path: "representante.doc_numero", label: "Documento do representante", type: "text", group: "Representante", applies: "COLETIVA" },
  // Veículo e intervenientes
  { path: "veiculo.matricula", label: "Matrícula", type: "text", group: "Veículo" },
  { path: "veiculo.marca_modelo", label: "Marca e modelo", type: "text", group: "Veículo" },
  { path: "titular.nome_efetivo", label: "Titular do veículo (nome)", type: "text", group: "Intervenientes" },
  { path: "titular.nif", label: "NIF do titular (se diferente)", type: "nif", group: "Intervenientes" },
  { path: "condutor.nome_efetivo", label: "Condutor (nome)", type: "text", group: "Intervenientes" },
  { path: "condutor.nif", label: "NIF do condutor (terceiro)", type: "nif", group: "Intervenientes" },
  { path: "condutor.carta_conducao", label: "Carta de condução do condutor", type: "text", group: "Intervenientes" },
  { path: "condutor.morada", label: "Morada do condutor", type: "text", group: "Intervenientes" },
  { path: "condutor.doc_tipo_extenso", label: "Tipo de documento do condutor", type: "text", group: "Intervenientes" },
  { path: "condutor.doc_numero", label: "N.º do documento do condutor", type: "text", group: "Intervenientes" },
  { path: "condutor.doc_emitente", label: "Entidade emissora do documento do condutor", type: "text", group: "Intervenientes" },
  // Infração
  { path: "infracao.numero_auto", label: "N.º do auto de contraordenação", type: "text", group: "Infração" },
  { path: "infracao.data", label: "Data da infração", type: "date", group: "Infração" },
  { path: "infracao.hora", label: "Hora da infração", type: "time", group: "Infração" },
  { path: "infracao.local", label: "Local da infração", type: "text", group: "Infração" },
  { path: "infracao.tipo_via_extenso", label: "Tipo de via", type: "text", group: "Infração" },
  { path: "infracao.meio_detecao_extenso", label: "Meio de deteção", type: "text", group: "Infração" },
  { path: "infracao.velocidade_maxima", label: "Velocidade máxima permitida", type: "number", group: "Infração" },
  { path: "infracao.velocidade_registada", label: "Velocidade registada", type: "number", group: "Infração" },
  { path: "infracao.velocidade_considerada", label: "Velocidade considerada", type: "number", group: "Infração" },
  { path: "infracao.entidade_autuante_extenso", label: "Entidade autuante", type: "text", group: "Infração" },
  { path: "infracao.entidade_numero", label: "N.º da entidade autuante", type: "text", group: "Infração" },
  { path: "infracao.entidade_morada", label: "Morada da entidade autuante", type: "text", group: "Infração" },
  { path: "infracao.entidade_codigo_postal", label: "Código postal da entidade autuante", type: "text", group: "Infração" },
  { path: "infracao.entidade_localidade", label: "Localidade da entidade autuante", type: "text", group: "Infração" },
  { path: "infracao.np", label: "NP (n.º de processo, se constar)", type: "text", group: "Infração" },
  { path: "infracao.data_notificacao", label: "Data da notificação", type: "date", group: "Infração" },
  { path: "infracao.data_rececao", label: "Data de receção da notificação", type: "date", group: "Infração" },
  // Informação adicional
  { path: "adicional.descricao", label: "Descrição do cliente", type: "text", group: "Adicional" },
  { path: "adicional.observacoes", label: "Observações", type: "text", group: "Adicional" },
  // Minuta (metadados validados juridicamente)
  { path: "minuta.entidade_competente", label: "Entidade competente (definida na minuta)", type: "text", group: "Minuta" },
  { path: "minuta.codigo", label: "Código da minuta", type: "text", group: "Minuta" },
  { path: "minuta.versao", label: "Versão da minuta", type: "number", group: "Minuta" },
  // Calculados
  { path: "calc.data_hoje", label: "Data de hoje", type: "date", group: "Calculados" },
  { path: "calc.excesso_velocidade", label: "Excesso de velocidade (km/h)", type: "number", group: "Calculados" },
  { path: "calc.prazo_indicativo", label: "Prazo indicativo de defesa", type: "date", group: "Calculados" },
  // Indicadores para parágrafos condicionais
  { path: "flags.pessoa_singular", label: "É pessoa singular", type: "boolean", group: "Condições" },
  { path: "flags.pessoa_coletiva", label: "É pessoa coletiva", type: "boolean", group: "Condições" },
  { path: "flags.tem_representante", label: "Tem representante legal", type: "boolean", group: "Condições" },
  { path: "flags.requerente_e_titular", label: "Requerente é o titular", type: "boolean", group: "Condições" },
  { path: "flags.requerente_e_condutor", label: "Requerente era o condutor", type: "boolean", group: "Condições" },
  { path: "flags.titular_diferente", label: "Titular é outra pessoa", type: "boolean", group: "Condições" },
  { path: "flags.condutor_identificado", label: "Condutor identificado", type: "boolean", group: "Condições" },
  { path: "flags.condutor_terceiro", label: "Condutor é terceiro", type: "boolean", group: "Condições" },
  { path: "flags.condutor_representante", label: "Condutor é o representante", type: "boolean", group: "Condições" },
  { path: "flags.condutor_nao_identificado", label: "Condutor não identificado", type: "boolean", group: "Condições" },
  { path: "flags.tem_hora", label: "Hora indicada", type: "boolean", group: "Condições" },
  { path: "flags.tem_velocidade_registada", label: "Velocidade registada indicada", type: "boolean", group: "Condições" },
  { path: "flags.tem_data_notificacao", label: "Data de notificação indicada", type: "boolean", group: "Condições" },
  { path: "flags.tem_descricao", label: "Cliente descreveu o sucedido", type: "boolean", group: "Condições" },
  { path: "flags.tem_observacoes", label: "Tem observações", type: "boolean", group: "Condições" },
];

/** Campos usados em condições de seleção (para o editor de condições). */
export const CONDITION_FIELDS: { path: string; label: string }[] = [
  { path: "requerente.tipo", label: "Tipo de requerente (SINGULAR/COLETIVA)" },
  { path: "requerente.papel", label: "Papel do requerente (TITULAR_E_CONDUTOR/TITULAR/CONDUTOR)" },
  { path: "condutor.identificacao", label: "Identificação do condutor" },
  { path: "infracao.entidade_autuante", label: "Entidade autuante (código)" },
  { path: "infracao.tipo_via", label: "Tipo de via (código)" },
  { path: "infracao.meio_detecao", label: "Meio de deteção (código)" },
  { path: "calc.excesso_velocidade", label: "Excesso de velocidade (km/h)" },
  ...FIELD_CATALOG.filter((f) => f.type === "boolean").map((f) => ({ path: f.path, label: f.label })),
];

export const FORMATS: Record<string, string> = {
  text: "Texto tal como introduzido",
  upper: "MAIÚSCULAS",
  date_long: "Data por extenso (5 de novembro de 2026)",
  date_short: "Data curta (05/11/2026)",
  time: "Hora (14h30)",
  number: "Número",
  kmh: "Velocidade (120 km/h)",
  nif: "NIF/NIPC (123 456 789)",
  boolean: "Condição (para parágrafos {{#…}}…{{/…}})",
};

export function catalogField(path: string) {
  return FIELD_CATALOG.find((f) => f.path === path);
}
