import type { CaseDataInput } from "@/modules/cases/schema";

export const singularInput: CaseDataInput = {
  categoria: "EXCESSO_VELOCIDADE",
  requerente: {
    tipo: "SINGULAR",
    nome: "Maria Teste Exemplo",
    nif: "123456789",
    doc_tipo: "CC",
    doc_numero: "12345678 9 ZZ1",
    morada: "Rua de Teste, 1",
    codigo_postal: "1000-001",
    localidade: "Lisboa",
    email: "maria@example.com",
    telefone: "912345678",
  },
  veiculo: { matricula: "aa00bb", marca_modelo: "Marca Modelo" },
  titular: { e_requerente: true },
  condutor: { identificacao: "REQUERENTE" },
  infracao: {
    numero_auto: "123456789",
    data: "2026-10-01",
    hora: "14:30",
    local: "A1, km 10",
    tipo_via: "AUTOESTRADA",
    meio_detecao: "RADAR_FIXO",
    velocidade_maxima: 120,
    velocidade_registada: 141,
    velocidade_considerada: 134,
    entidade_autuante: "GNR",
    data_rececao: "2026-10-20",
  },
  adicional: {},
};

export const coletivaInput: CaseDataInput = {
  ...singularInput,
  requerente: {
    tipo: "COLETIVA",
    denominacao: "Empresa Teste, Lda.",
    nipc: "503504564",
    morada: "Avenida de Teste, 10",
    codigo_postal: "4000-001",
    localidade: "Porto",
    email: "geral@example.com",
    telefone: "221234567",
  },
  representante: { nome: "João Representante", nif: "123456789", cargo: "Gerente" },
  condutor: { identificacao: "OUTRA_PESSOA", nome: "Carlos Condutor", nif: "123456789" },
};
