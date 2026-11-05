import { z } from "zod";
import { getByPath, isEmpty } from "@/modules/fields/format";

/**
 * Condições de utilização de uma minuta.
 * { "all": [regra, ...], "any": [regra, ...] }  — "all" tem de ser todo verdadeiro;
 * "any" (se existir e não vazio) exige pelo menos uma regra verdadeira.
 */
export const OPERATORS = ["eq", "neq", "in", "notIn", "gt", "gte", "lt", "lte", "exists", "notExists", "isTrue", "isFalse"] as const;
export type Operator = (typeof OPERATORS)[number];

export const ruleSchema = z.object({
  field: z.string().min(1),
  op: z.enum(OPERATORS),
  value: z.unknown().optional(),
});
export type Rule = z.infer<typeof ruleSchema>;

export const conditionsSchema = z.object({
  all: z.array(ruleSchema).default([]),
  any: z.array(ruleSchema).default([]),
});
export type Conditions = z.infer<typeof conditionsSchema>;

export const OPERATOR_LABELS: Record<Operator, string> = {
  eq: "é igual a",
  neq: "é diferente de",
  in: "é um de (lista separada por vírgulas)",
  notIn: "não é um de",
  gt: "maior que",
  gte: "maior ou igual a",
  lt: "menor que",
  lte: "menor ou igual a",
  exists: "está preenchido",
  notExists: "não está preenchido",
  isTrue: "é verdadeiro",
  isFalse: "é falso",
};

function asList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [v];
}

function loose(a: unknown, b: unknown) {
  return String(a) === String(b);
}

export function evaluateRule(rule: Rule, ctx: unknown): boolean {
  const actual = getByPath(ctx, rule.field);
  switch (rule.op) {
    case "eq":
      return loose(actual, rule.value);
    case "neq":
      return !loose(actual, rule.value);
    case "in":
      return asList(rule.value).some((v) => loose(actual, v));
    case "notIn":
      return !asList(rule.value).some((v) => loose(actual, v));
    case "gt":
      return Number(actual) > Number(rule.value);
    case "gte":
      return Number(actual) >= Number(rule.value);
    case "lt":
      return Number(actual) < Number(rule.value);
    case "lte":
      return Number(actual) <= Number(rule.value);
    case "exists":
      return !isEmpty(actual);
    case "notExists":
      return isEmpty(actual);
    case "isTrue":
      return actual === true;
    case "isFalse":
      return actual !== true;
  }
}

export function describeRule(rule: Rule) {
  const needsValue = !["exists", "notExists", "isTrue", "isFalse"].includes(rule.op);
  return `${rule.field} ${OPERATOR_LABELS[rule.op]}${needsValue ? ` ${JSON.stringify(rule.value)}` : ""}`;
}

export function evaluateConditions(raw: unknown, ctx: unknown): { ok: boolean; failed: string[] } {
  const parsed = conditionsSchema.safeParse(raw ?? {});
  if (!parsed.success) return { ok: false, failed: ["Condições da minuta inválidas"] };
  const { all, any } = parsed.data;
  const failed = all.filter((r) => !evaluateRule(r, ctx)).map(describeRule);
  if (any.length > 0 && !any.some((r) => evaluateRule(r, ctx))) {
    failed.push(`nenhuma das condições alternativas: ${any.map(describeRule).join(" | ")}`);
  }
  return { ok: failed.length === 0, failed };
}
