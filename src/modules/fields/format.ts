import { formatNif } from "./validators";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function isEmpty(v: unknown) {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

export function formatDateLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function formatDateShort(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Aplica um formatador a um valor do contexto. */
export function formatValue(value: unknown, format: string): unknown {
  if (format === "boolean") return Boolean(value);
  if (isEmpty(value)) return value;
  const s = String(value);
  switch (format) {
    case "upper":
      return s.toLocaleUpperCase("pt-PT");
    case "date_long":
      return formatDateLong(s);
    case "date_short":
      return formatDateShort(s);
    case "time":
      return s.replace(":", "h");
    case "number":
      return new Intl.NumberFormat("pt-PT").format(Number(s));
    case "kmh":
      return `${s} km/h`;
    case "nif":
      return formatNif(s);
    default:
      return s;
  }
}
