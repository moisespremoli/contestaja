import type { CaseDataInput } from "@/modules/cases/schema";

/** Dados fictícios para testar o preenchimento antes de disponibilizar a minuta. */
export function sampleData(applicantType: "SINGULAR" | "COLETIVA", categoryCode: string): CaseDataInput {
  const base: CaseDataInput = {
    categoria: categoryCode,
    requerente: {
      tipo: "SINGULAR",
      nome: "Nome Fictício de Teste",
      nif: "123456789",
      doc_tipo: "CC",
      doc_numero: "00000000 0 ZZ0",
      doc_emitente: "República Portuguesa",
      morada: "Rua Fictícia, n.º 1",
      codigo_postal: "1000-001",
      localidade: "Lisboa",
      email: "teste@example.com",
      telefone: "910000000",
    },
    veiculo: { matricula: "AA-00-AA", marca_modelo: "Marca Modelo" },
    titular: { e_requerente: true },
    condutor: {
      identificacao: "OUTRA_PESSOA",
      nome: "Condutor Fictício",
      nif: "123456789",
      morada: "Rua do Condutor Fictício, n.º 2, 3000-001 Coimbra",
      doc_tipo: "CC",
      doc_numero: "11111111 1 ZZ1",
      doc_emitente: "República Portuguesa",
      carta_conducao: "C-000000 0",
    },
    infracao: {
      numero_auto: "000000000",
      data: "2026-01-15",
      hora: "10:45",
      local: "Local de teste",
      tipo_via: "FORA_LOCALIDADE",
      meio_detecao: "RADAR_FIXO",
      velocidade_maxima: 90,
      velocidade_registada: 112,
      velocidade_considerada: 106,
      entidade_autuante: "GNR",
      data_notificacao: "2026-02-01",
      data_rececao: "2026-02-05",
      np: "NP-000000",
      entidade_numero: "000000000",
      entidade_morada: "Morada Fictícia da Entidade, n.º 1",
      entidade_codigo_postal: "2000-001",
      entidade_localidade: "Localidade Fictícia",
    },
    adicional: { descricao: "Descrição fictícia apresentada pelo cliente.", observacoes: "Observação fictícia." },
  };
  if (applicantType === "COLETIVA") {
    return {
      ...base,
      requerente: {
        tipo: "COLETIVA",
        denominacao: "Empresa Fictícia de Teste, Lda.",
        nipc: "503504564",
        morada: "Avenida Fictícia, n.º 10",
        codigo_postal: "4000-001",
        localidade: "Porto",
        email: "empresa@example.com",
        telefone: "220000000",
      },
      representante: { nome: "Representante Fictício", nif: "123456789", cargo: "Gerente" },
    };
  }
  return base;
}
