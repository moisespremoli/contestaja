import Docxtemplater from "docxtemplater";
import InspectModule from "docxtemplater/js/inspect-module.js";
import PizZip from "pizzip";
import { formatValue, getByPath, isEmpty } from "@/modules/fields/format";

/**
 * Motor de preenchimento DOCX.
 * - Marcadores: {{NOME}}; parágrafos condicionais aprovados: {{#COND}}…{{/COND}} e {{^COND}}…{{/COND}}.
 * - Substitui no corpo, cabeçalhos e rodapés, preservando estilos, numeração e campos de página.
 * - Nunca acrescenta texto que não exista na minuta.
 */

const DELIMITERS = { start: "{{", end: "}}" };

export interface Placeholder {
  name: string;
  kind: "variable" | "section";
}

export interface FieldMapping {
  placeholder: string;
  sourcePath: string;
  format: string;
  required: boolean;
  defaultValue?: string | null;
}

export interface FillResult {
  buffer: Buffer;
  /** Marcadores obrigatórios sem valor. */
  missingRequired: { placeholder: string; sourcePath: string }[];
  /** Marcadores presentes na minuta sem mapeamento definido. */
  unmapped: string[];
}

export class TemplateError extends Error {}

function load(buf: Buffer, modules: unknown[] = []) {
  let zip: PizZip;
  try {
    zip = new PizZip(buf);
  } catch {
    throw new TemplateError("O ficheiro não é um DOCX válido.");
  }
  try {
    return new Docxtemplater(zip, {
      delimiters: DELIMITERS,
      paragraphLoop: true,
      linebreaks: true,
      modules: modules as never[],
    });
  } catch (err) {
    throw new TemplateError(describeDocxError(err));
  }
}

function describeDocxError(err: unknown): string {
  const e = err as { properties?: { errors?: { properties?: { explanation?: string } }[] }; message?: string };
  const list = e.properties?.errors?.map((x) => x.properties?.explanation).filter(Boolean);
  return list?.length ? `Erros na minuta: ${list.join("; ")}` : (e.message ?? "Erro ao processar a minuta");
}

type Part = { type: string; value: string; module?: string; subparsed?: Part[] };

/** Extrai todos os marcadores da minuta (corpo, cabeçalhos e rodapés). */
export function extractPlaceholders(buf: Buffer): Placeholder[] {
  const inspect = new InspectModule();
  load(buf, [inspect]);
  const found = new Map<string, Placeholder["kind"]>();
  const walk = (parts: Part[]) => {
    for (const p of parts) {
      if (p.type !== "placeholder") continue;
      const kind = p.module === "loop" ? "section" : "variable";
      if (!found.has(p.value) || kind === "section") found.set(p.value, kind);
      if (p.subparsed) walk(p.subparsed);
    }
  };
  walk(inspect.getAllStructuredTags() as unknown as Part[]);
  return [...found.entries()].map(([name, kind]) => ({ name, kind })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Constrói os valores a injetar a partir dos mapeamentos e do contexto do processo. */
export function resolveValues(mappings: FieldMapping[], context: unknown) {
  const values: Record<string, unknown> = {};
  const missingRequired: FillResult["missingRequired"] = [];
  for (const m of mappings) {
    let raw = getByPath(context, m.sourcePath);
    if (isEmpty(raw) && m.defaultValue) raw = m.defaultValue;
    const formatted = formatValue(raw, m.format);
    if (m.format !== "boolean" && isEmpty(formatted) && m.required) {
      missingRequired.push({ placeholder: m.placeholder, sourcePath: m.sourcePath });
    }
    values[m.placeholder] = m.format === "boolean" ? formatted : (formatted ?? "");
  }
  return { values, missingRequired };
}

export function fillDocx(templateBuf: Buffer, mappings: FieldMapping[], context: unknown): FillResult {
  const placeholders = extractPlaceholders(templateBuf);
  const mapped = new Set(mappings.map((m) => m.placeholder));
  const unmapped = placeholders.filter((p) => !mapped.has(p.name)).map((p) => p.name);
  const { values, missingRequired } = resolveValues(mappings, context);

  // Marcadores sem valor ficam vazios (e são reportados acima) — nunca inventados.
  const doc = load(templateBuf);
  try {
    doc.render(values);
  } catch (err) {
    throw new TemplateError(describeDocxError(err));
  }
  const buffer = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  return { buffer, missingRequired, unmapped };
}
