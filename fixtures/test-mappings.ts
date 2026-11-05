import type { FieldMapping } from "../src/modules/docgen/engine";

/** Mapeamentos das minutas de TESTE (equivalente ao que o admin configura no editor de mapeamento). */
const comuns: FieldMapping[] = [
  { placeholder: "ENTIDADE_DESTINATARIA", sourcePath: "minuta.entidade_competente", format: "text", required: true },
  { placeholder: "MORADA_COMPLETA", sourcePath: "requerente.morada_completa", format: "text", required: true },
  { placeholder: "LOCALIDADE", sourcePath: "requerente.localidade", format: "text", required: true },
  { placeholder: "NUMERO_AUTO", sourcePath: "infracao.numero_auto", format: "text", required: true },
  { placeholder: "DATA_INFRACAO", sourcePath: "infracao.data", format: "date_long", required: true },
  { placeholder: "HORA_INFRACAO", sourcePath: "infracao.hora", format: "time", required: false },
  { placeholder: "TEM_HORA", sourcePath: "flags.tem_hora", format: "boolean", required: false },
  { placeholder: "LOCAL_INFRACAO", sourcePath: "infracao.local", format: "text", required: true },
  { placeholder: "MATRICULA", sourcePath: "veiculo.matricula", format: "upper", required: true },
  { placeholder: "VELOCIDADE_CONSIDERADA", sourcePath: "infracao.velocidade_considerada", format: "kmh", required: true },
  { placeholder: "VELOCIDADE_MAXIMA", sourcePath: "infracao.velocidade_maxima", format: "kmh", required: true },
  { placeholder: "VELOCIDADE_REGISTADA", sourcePath: "infracao.velocidade_registada", format: "kmh", required: false },
  { placeholder: "TEM_VEL_REGISTADA", sourcePath: "flags.tem_velocidade_registada", format: "boolean", required: false },
  { placeholder: "DATA_RECECAO", sourcePath: "infracao.data_rececao", format: "date_long", required: true },
  { placeholder: "CONDUTOR_TERCEIRO", sourcePath: "flags.condutor_terceiro", format: "boolean", required: false },
  { placeholder: "CONDUTOR_NOME", sourcePath: "condutor.nome_efetivo", format: "text", required: false },
  { placeholder: "CONDUTOR_NIF", sourcePath: "condutor.nif", format: "nif", required: false },
  { placeholder: "TEM_DESCRICAO", sourcePath: "flags.tem_descricao", format: "boolean", required: false },
  { placeholder: "DESCRICAO_CLIENTE", sourcePath: "adicional.descricao", format: "text", required: false },
  { placeholder: "DATA_HOJE", sourcePath: "calc.data_hoje", format: "date_long", required: true },
];

export const TEST_MAPPINGS_PS: FieldMapping[] = [
  ...comuns,
  { placeholder: "NOME_COMPLETO", sourcePath: "requerente.nome", format: "text", required: true },
  { placeholder: "NIF", sourcePath: "requerente.nif", format: "nif", required: true },
  { placeholder: "DOC_TIPO", sourcePath: "requerente.doc_tipo_extenso", format: "text", required: true },
  { placeholder: "NUMERO_DOCUMENTO", sourcePath: "requerente.doc_numero", format: "text", required: true },
];

export const TEST_MAPPINGS_PC: FieldMapping[] = [
  ...comuns,
  { placeholder: "DENOMINACAO_SOCIAL", sourcePath: "requerente.denominacao", format: "text", required: true },
  { placeholder: "NIPC", sourcePath: "requerente.nipc", format: "nif", required: true },
  { placeholder: "REPRESENTANTE_NOME", sourcePath: "representante.nome", format: "text", required: true },
  { placeholder: "REPRESENTANTE_NIF", sourcePath: "representante.nif", format: "nif", required: true },
  { placeholder: "REPRESENTANTE_CARGO", sourcePath: "representante.cargo", format: "text", required: true },
];
