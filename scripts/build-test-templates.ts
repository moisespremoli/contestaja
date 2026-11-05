/**
 * Gera minutas DOCX de TESTE (claramente identificadas) para desenvolvimento.
 * NÃO são minutas jurídicas: não contêm fundamentos de direito. Serão substituídas
 * pelas minutas reais validadas por profissional jurídico através do painel admin.
 *
 *   npx tsx scripts/build-test-templates.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";

const OUT = path.resolve("fixtures/templates");
const FONT = "Times New Roman";

const p = (text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; numbered?: boolean } = {}) =>
  new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 360 },
    numbering: opts.numbered ? { reference: "artigos", level: 0 } : undefined,
    children: [new TextRun({ text, bold: opts.bold, font: FONT, size: 24 })],
  });

const testBanner = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text, bold: true, color: "C00000", font: FONT, size: 20 })],
  });

function build(kind: "PS" | "PC") {
  const isPC = kind === "PC";
  const identification = isPC
    ? "{{DENOMINACAO_SOCIAL}}, pessoa coletiva n.º {{NIPC}}, com sede em {{MORADA_COMPLETA}}, neste ato representada por {{REPRESENTANTE_NOME}}, NIF {{REPRESENTANTE_NIF}}, na qualidade de {{REPRESENTANTE_CARGO}},"
    : "{{NOME_COMPLETO}}, NIF {{NIF}}, titular do {{DOC_TIPO}} n.º {{NUMERO_DOCUMENTO}}, residente em {{MORADA_COMPLETA}},";

  const body: Paragraph[] = [
    testBanner("MINUTA DE TESTE — DOCUMENTO SEM VALOR JURÍDICO — NÃO UTILIZAR"),
    p("Exmo. Senhor Presidente da {{ENTIDADE_DESTINATARIA}},", { bold: true, align: AlignmentType.LEFT }),
    p(""),
    p(
      `${identification} vem, relativamente ao auto de contraordenação n.º {{NUMERO_AUTO}}, referente à infração alegadamente ocorrida em {{DATA_INFRACAO}}{{#TEM_HORA}}, pelas {{HORA_INFRACAO}}{{/TEM_HORA}}, em {{LOCAL_INFRACAO}}, com o veículo de matrícula {{MATRICULA}}, apresentar a sua DEFESA, nos termos seguintes:`,
    ),
    p("I — DOS FACTOS", { bold: true, align: AlignmentType.CENTER }),
    p(
      "No auto é imputada a circulação a {{VELOCIDADE_CONSIDERADA}}, num local cujo limite é de {{VELOCIDADE_MAXIMA}}{{#TEM_VEL_REGISTADA}}, tendo sido registada a velocidade de {{VELOCIDADE_REGISTADA}}{{/TEM_VEL_REGISTADA}}.",
      { numbered: true },
    ),
    p("A notificação foi recebida em {{DATA_RECECAO}}.", { numbered: true }),
    p("{{#CONDUTOR_TERCEIRO}}"),
    p(
      "[PARÁGRAFO CONDICIONAL DE TESTE] Identificação do condutor indicado pelo requerente: {{CONDUTOR_NOME}}{{#CONDUTOR_NIF}}, NIF {{CONDUTOR_NIF}}{{/CONDUTOR_NIF}}.",
      { numbered: true },
    ),
    p("{{/CONDUTOR_TERCEIRO}}"),
    p("{{#TEM_DESCRICAO}}"),
    p("Descrição apresentada pelo requerente: {{DESCRICAO_CLIENTE}}", { numbered: true }),
    p("{{/TEM_DESCRICAO}}"),
    p("II — DO DIREITO", { bold: true, align: AlignmentType.CENTER }),
    p(
      "[TEXTO DE TESTE — os fundamentos jurídicos serão os da minuta real, validada por profissional qualificado. Este sistema não gera fundamentos de direito.]",
      { numbered: true },
    ),
    p("III — DO PEDIDO", { bold: true, align: AlignmentType.CENTER }),
    p("[PEDIDO DE TESTE — a definir na minuta real.]", { numbered: true }),
    p(""),
    p("{{LOCALIDADE}}, {{DATA_HOJE}}", { align: AlignmentType.LEFT }),
    p(""),
    p("_______________________________________", { align: AlignmentType.CENTER }),
    p(isPC ? "({{REPRESENTANTE_NOME}}, em representação de {{DENOMINACAO_SOCIAL}})" : "({{NOME_COMPLETO}})", {
      align: AlignmentType.CENTER,
    }),
  ];

  return new Document({
    creator: "ContestaJá — gerador de minutas de teste",
    title: `Minuta de teste ${kind}`,
    numbering: {
      config: [
        {
          reference: "artigos",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.º", alignment: AlignmentType.LEFT }],
        },
      ],
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "MINUTA DE TESTE · Auto n.º {{NUMERO_AUTO}}", font: FONT, size: 18, color: "808080" }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], font: FONT, size: 18 }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const kind of ["PS", "PC"] as const) {
    const buf = await Packer.toBuffer(build(kind));
    const file = path.join(OUT, `TESTE-VEL-${kind}.docx`);
    await writeFile(file, buf);
    console.log("✓", file);
  }
}

main();
