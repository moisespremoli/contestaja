import { readFileSync } from "node:fs";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { TEST_MAPPINGS_PC, TEST_MAPPINGS_PS } from "../fixtures/test-mappings";
import { buildContext, addBusinessDays } from "@/modules/cases/derive";
import { caseDataSchema } from "@/modules/cases/schema";
import { extractPlaceholders, fillDocx } from "@/modules/docgen/engine";
import { isValidNif, isValidNipc, isValidPlate, normalizePlate } from "@/modules/fields/validators";
import { selectTemplate, type CandidateTemplate } from "@/modules/selection/engine";
import { coletivaInput, singularInput } from "./fixtures";

const ctxOf = (input: unknown) => {
  const data = caseDataSchema.parse(input);
  return {
    data,
    ctx: {
      ...buildContext(data, { today: "2026-11-05" }),
      minuta: { entidade_competente: "Entidade de Teste", codigo: "T", versao: 1 },
    },
  };
};

const tpl = (over: Partial<CandidateTemplate>): CandidateTemplate => ({
  id: "t",
  code: "T",
  internalName: "T",
  categoryCode: "EXCESSO_VELOCIDADE",
  applicantType: "SINGULAR",
  status: "ACTIVE",
  priority: 0,
  conditions: {},
  currentVersionId: "v",
  ...over,
});

describe("validadores", () => {
  it("valida NIF/NIPC", () => {
    expect(isValidNif("123456789")).toBe(true);
    expect(isValidNif("123456780")).toBe(false);
    expect(isValidNipc("503504564")).toBe(true);
    expect(isValidNipc("123456789")).toBe(false);
  });
  it("normaliza matrículas", () => {
    expect(normalizePlate("aa00bb")).toBe("AA-00-BB");
    expect(isValidPlate("AA-00-BB")).toBe(true);
    expect(isValidPlate("AAA-00")).toBe(false);
  });
  it("conta dias úteis", () => {
    expect(addBusinessDays("2026-11-06", 1)).toBe("2026-11-09"); // sexta -> segunda
  });
});

describe("motor de seleção", () => {
  const ps = tpl({ id: "ps", code: "PS", applicantType: "SINGULAR", currentVersionId: "vps" });
  const pc = tpl({ id: "pc", code: "PC", applicantType: "COLETIVA", currentVersionId: "vpc" });

  it("pessoa singular -> minuta singular", () => {
    const { data, ctx } = ctxOf(singularInput);
    const r = selectTemplate({ categoryCode: data.categoria, applicantType: "SINGULAR", context: ctx }, [ps, pc]);
    expect(r.outcome).toBe("SELECTED");
    expect(r.templateId).toBe("ps");
  });

  it("pessoa coletiva -> minuta coletiva, nunca a singular", () => {
    const { data, ctx } = ctxOf(coletivaInput);
    const r = selectTemplate({ categoryCode: data.categoria, applicantType: "COLETIVA", context: ctx }, [ps, pc]);
    expect(r.templateId).toBe("pc");
    const onlySingular = selectTemplate({ categoryCode: data.categoria, applicantType: "COLETIVA", context: ctx }, [ps]);
    expect(onlySingular.outcome).toBe("NO_TEMPLATE");
  });

  it("sem minuta ativa -> NO_TEMPLATE", () => {
    const { data, ctx } = ctxOf(singularInput);
    const r = selectTemplate({ categoryCode: data.categoria, applicantType: "SINGULAR", context: ctx }, [
      tpl({ status: "INACTIVE" }),
    ]);
    expect(r.outcome).toBe("NO_TEMPLATE");
  });

  it("empate de prioridade -> AMBIGUOUS", () => {
    const { data, ctx } = ctxOf(singularInput);
    const r = selectTemplate({ categoryCode: data.categoria, applicantType: "SINGULAR", context: ctx }, [
      tpl({ id: "a", code: "A" }),
      tpl({ id: "b", code: "B" }),
    ]);
    expect(r.outcome).toBe("AMBIGUOUS");
  });

  it("condições e prioridade", () => {
    const { data, ctx } = ctxOf(singularInput);
    const gnrOnly = tpl({
      id: "gnr",
      code: "GNR",
      priority: 10,
      conditions: { all: [{ field: "infracao.entidade_autuante", op: "eq", value: "GNR" }] },
    });
    const pspOnly = tpl({
      id: "psp",
      code: "PSP",
      priority: 20,
      conditions: { all: [{ field: "infracao.entidade_autuante", op: "eq", value: "PSP" }] },
    });
    const r = selectTemplate({ categoryCode: data.categoria, applicantType: "SINGULAR", context: ctx }, [gnrOnly, pspOnly, tpl({})]);
    expect(r.templateId).toBe("gnr");
  });

  it("requerente sem legitimidade -> LEGITIMACY_ISSUE", () => {
    const { data, ctx } = ctxOf({
      ...singularInput,
      titular: { e_requerente: false, nome: "Outro Titular" },
      condutor: { identificacao: "OUTRA_PESSOA", nome: "Terceiro" },
    });
    const r = selectTemplate({ categoryCode: data.categoria, applicantType: "SINGULAR", context: ctx }, [ps]);
    expect(r.outcome).toBe("LEGITIMACY_ISSUE");
  });
});

describe("motor de preenchimento DOCX", () => {
  const docText = (buf: Buffer) => {
    const zip = new PizZip(buf);
    return ["word/document.xml", "word/header1.xml"]
      .map((f) => zip.file(f)?.asText() ?? "")
      .join(" ")
      .replace(/<[^>]+>/g, "");
  };

  it("extrai marcadores (incluindo cabeçalho e secções)", () => {
    const buf = readFileSync("fixtures/templates/TESTE-VEL-PS.docx");
    const names = extractPlaceholders(buf);
    expect(names.find((p) => p.name === "NOME_COMPLETO")?.kind).toBe("variable");
    expect(names.find((p) => p.name === "CONDUTOR_TERCEIRO")?.kind).toBe("section");
    expect(names.some((p) => p.name === "NUMERO_AUTO")).toBe(true);
  });

  it("preenche minuta singular sem campos em falta", () => {
    const { ctx } = ctxOf(singularInput);
    const r = fillDocx(readFileSync("fixtures/templates/TESTE-VEL-PS.docx"), TEST_MAPPINGS_PS, ctx);
    expect(r.unmapped).toEqual([]);
    expect(r.missingRequired).toEqual([]);
    const text = docText(r.buffer);
    expect(text).toContain("Maria Teste Exemplo");
    expect(text).toContain("1 de outubro de 2026");
    expect(text).toContain("134 km/h");
    expect(text).toContain("AA-00-BB");
    expect(text).not.toContain("{{");
    expect(text).not.toContain("PARÁGRAFO CONDICIONAL"); // condutor não é terceiro
  });

  it("inclui parágrafo condicional e dados do representante (coletiva)", () => {
    const { ctx } = ctxOf(coletivaInput);
    const r = fillDocx(readFileSync("fixtures/templates/TESTE-VEL-PC.docx"), TEST_MAPPINGS_PC, ctx);
    expect(r.missingRequired).toEqual([]);
    const text = docText(r.buffer);
    expect(text).toContain("Empresa Teste, Lda.");
    expect(text).toContain("João Representante");
    expect(text).toContain("PARÁGRAFO CONDICIONAL DE TESTE");
    expect(text).toContain("Carlos Condutor");
  });

  it("reporta obrigatórios em falta e marcadores sem mapeamento", () => {
    const { ctx } = ctxOf(singularInput);
    const mappings = TEST_MAPPINGS_PS.filter((m) => m.placeholder !== "NIF").map((m) =>
      m.placeholder === "HORA_INFRACAO" ? { ...m, sourcePath: "infracao.inexistente", required: true } : m,
    );
    const r = fillDocx(readFileSync("fixtures/templates/TESTE-VEL-PS.docx"), mappings, ctx);
    expect(r.unmapped).toContain("NIF");
    expect(r.missingRequired.map((m) => m.placeholder)).toContain("HORA_INFRACAO");
  });
});
