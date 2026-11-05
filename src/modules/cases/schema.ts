import { z } from "zod";
import {
  isValidIsoDate,
  isValidNif,
  isValidNipc,
  isValidPhone,
  isValidPlate,
  isValidPostalCode,
  isValidTime,
  normalizePlate,
  onlyDigits,
} from "@/modules/fields/validators";

/**
 * Schema dos dados recolhidos no formulário.
 * Os mínimos aqui exigidos são os necessários para a seleção de minuta e para o contacto;
 * a obrigatoriedade adicional é definida por cada minuta (mapeamentos "required").
 */

const opt = z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined));
const req = (msg: string) => z.string().trim().min(1, msg).max(500);

const nif = z.string().trim().refine(isValidNif, "NIF inválido");
const nifOpt = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || isValidNif(v), "NIF inválido")
  .transform((v) => (v ? onlyDigits(v) : undefined));
const isoDate = (msg: string) => z.string().refine(isValidIsoDate, msg);
const isoDateOpt = z
  .string()
  .optional()
  .refine((v) => !v || isValidIsoDate(v), "Data inválida")
  .transform((v) => v || undefined);
const timeOpt = z
  .string()
  .optional()
  .refine((v) => !v || isValidTime(v), "Hora inválida (HH:MM)")
  .transform((v) => v || undefined);
const speedOpt = z.coerce
  .number()
  .int()
  .min(0)
  .max(400)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const ENTIDADES_AUTUANTES = {
  ANSR: "Autoridade Nacional de Segurança Rodoviária (ANSR)",
  GNR: "Guarda Nacional Republicana (GNR)",
  PSP: "Polícia de Segurança Pública (PSP)",
  POLICIA_MUNICIPAL: "Polícia Municipal",
  CAMARA_MUNICIPAL: "Câmara Municipal",
  OUTRA: "Outra entidade",
} as const;

export const TIPOS_VIA = {
  DENTRO_LOCALIDADE: "Dentro de localidade",
  FORA_LOCALIDADE: "Fora de localidade",
  AUTOESTRADA: "Autoestrada",
  VIA_RESERVADA: "Via reservada a automóveis",
  NAO_SEI: "Não sei",
} as const;

export const MEIOS_DETECAO = {
  RADAR_FIXO: "Radar fixo",
  RADAR_MOVEL: "Radar móvel / operação de fiscalização",
  RADAR_VELOCIDADE_MEDIA: "Radar de velocidade média",
  NAO_SEI: "Não sei",
} as const;

export const DOC_TIPOS = {
  CC: "Cartão de Cidadão",
  BI: "Bilhete de Identidade",
  PASSAPORTE: "Passaporte",
  TITULO_RESIDENCIA: "Título de Residência",
} as const;

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const contactos = {
  morada: req("Indique a morada"),
  codigo_postal: z.string().trim().refine(isValidPostalCode, "Código postal inválido (0000-000)"),
  localidade: req("Indique a localidade"),
  email: z.string().trim().email("Email inválido"),
  telefone: z.string().trim().refine(isValidPhone, "Telefone inválido"),
};

export const requerenteSingularSchema = z.object({
  tipo: z.literal("SINGULAR"),
  nome: req("Indique o nome completo"),
  nif,
  doc_tipo: z.enum(keys(DOC_TIPOS)),
  doc_numero: req("Indique o número do documento de identificação"),
  doc_validade: isoDateOpt,
  doc_emitente: opt,
  ...contactos,
});

export const requerenteColetivaSchema = z.object({
  tipo: z.literal("COLETIVA"),
  denominacao: req("Indique a denominação social"),
  nipc: z.string().trim().refine(isValidNipc, "NIPC inválido"),
  ...contactos,
});

export const representanteSchema = z.object({
  nome: req("Indique o nome do representante legal"),
  nif,
  cargo: req("Indique o cargo ou qualidade"),
  doc_numero: opt,
});

export const titularSchema = z
  .object({
    e_requerente: z.boolean(),
    nome: opt,
    nif: nifOpt,
  })
  .refine((t) => t.e_requerente || !!t.nome, { message: "Indique o titular do veículo", path: ["nome"] });

export const CONDUTOR_OPCOES = {
  REQUERENTE: "O próprio requerente",
  REPRESENTANTE: "O representante legal",
  OUTRA_PESSOA: "Outra pessoa",
  NAO_IDENTIFICADO: "Não sei / não pretendo identificar neste momento",
} as const;

export const condutorSchema = z
  .object({
    identificacao: z.enum(keys(CONDUTOR_OPCOES)),
    nome: opt,
    nif: nifOpt,
    carta_conducao: opt,
    morada: opt,
    doc_tipo: z.enum(keys(DOC_TIPOS)).optional().or(z.literal("").transform(() => undefined)),
    doc_numero: opt,
    doc_emitente: opt,
  })
  .refine((c) => c.identificacao !== "OUTRA_PESSOA" || !!c.nome, {
    message: "Indique o nome do condutor",
    path: ["nome"],
  });

export const infracaoSchema = z
  .object({
    numero_auto: req("Indique o número do auto"),
    data: isoDate("Indique a data da infração"),
    hora: timeOpt,
    local: req("Indique o local da infração"),
    tipo_via: z.enum(keys(TIPOS_VIA)).default("NAO_SEI"),
    meio_detecao: z.enum(keys(MEIOS_DETECAO)).default("NAO_SEI"),
    velocidade_maxima: z.coerce.number().int().min(10, "Velocidade inválida").max(150),
    velocidade_registada: speedOpt,
    velocidade_considerada: z.coerce.number().int().min(1, "Velocidade inválida").max(400),
    entidade_autuante: z.enum(keys(ENTIDADES_AUTUANTES)),
    entidade_autuante_outra: opt,
    data_notificacao: isoDateOpt,
    data_rececao: isoDate("Indique a data em que recebeu a notificação"),
    np: opt,
    entidade_numero: opt,
    entidade_morada: opt,
    entidade_codigo_postal: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || isValidPostalCode(v), "Código postal inválido (0000-000)")
      .transform((v) => v || undefined),
    entidade_localidade: opt,
  })
  .refine((i) => i.velocidade_considerada > i.velocidade_maxima, {
    message: "A velocidade considerada deve ser superior à máxima permitida",
    path: ["velocidade_considerada"],
  })
  .refine((i) => i.entidade_autuante !== "OUTRA" || !!i.entidade_autuante_outra, {
    message: "Indique a entidade autuante",
    path: ["entidade_autuante_outra"],
  });

export const veiculoSchema = z.object({
  matricula: z
    .string()
    .transform(normalizePlate)
    .refine(isValidPlate, "Matrícula inválida (ex.: AA-00-AA)"),
  marca_modelo: opt,
});

export const adicionalSchema = z.object({
  descricao: z.string().trim().max(5000).optional(),
  observacoes: z.string().trim().max(3000).optional(),
});

export const caseDataSchema = z
  .object({
    categoria: z.string().min(1),
    requerente: z.discriminatedUnion("tipo", [requerenteSingularSchema, requerenteColetivaSchema]),
    representante: representanteSchema.optional(),
    veiculo: veiculoSchema,
    titular: titularSchema,
    condutor: condutorSchema,
    infracao: infracaoSchema,
    adicional: adicionalSchema.default({}),
  })
  .superRefine((d, ctx) => {
    if (d.requerente.tipo === "COLETIVA" && !d.representante) {
      ctx.addIssue({ code: "custom", message: "Indique o representante legal", path: ["representante", "nome"] });
    }
    if (d.requerente.tipo === "COLETIVA" && d.condutor.identificacao === "REQUERENTE") {
      ctx.addIssue({
        code: "custom",
        message: "Uma pessoa coletiva não pode ser condutora — escolha outra opção",
        path: ["condutor", "identificacao"],
      });
    }
    if (d.requerente.tipo === "SINGULAR" && d.condutor.identificacao === "REPRESENTANTE") {
      ctx.addIssue({ code: "custom", message: "Opção inválida para pessoa singular", path: ["condutor", "identificacao"] });
    }
  });

export type CaseData = z.infer<typeof caseDataSchema>;
export type CaseDataInput = z.input<typeof caseDataSchema>;

export const consentSchema = z.object({
  privacidade: z.literal(true, { error: "É necessário aceitar a política de privacidade" }),
  termos: z.literal(true, { error: "É necessário aceitar os termos do serviço" }),
  avisos: z.literal(true, { error: "É necessário confirmar que leu os avisos" }),
});
