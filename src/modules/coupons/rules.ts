/** Regras puras dos cupões (sem acesso à base de dados — testáveis). */

export type CouponLike = {
  code: string;
  percentOff: number;
  maxUses: number | null;
  usedCount: number;
  validUntil: Date | null;
  active: boolean;
};

export function normalizeCouponCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,40}$/;

/** Motivo pelo qual o cupão não pode ser usado, ou null se é válido. */
export function couponProblem(c: CouponLike | null, now = new Date()): string | null {
  if (!c || !c.active) return "Código promocional inválido.";
  if (c.validUntil && c.validUntil.getTime() <= now.getTime()) return "Este código promocional expirou.";
  if (c.maxUses != null && c.usedCount >= c.maxUses) return "Este código promocional já atingiu o limite de utilizações.";
  return null;
}

/** Valor a pagar após desconto (arredondado ao cêntimo, nunca negativo). */
export function discountedCents(priceCents: number, percentOff: number | null | undefined) {
  const pct = Math.min(100, Math.max(0, percentOff ?? 0));
  return Math.max(0, Math.round((priceCents * (100 - pct)) / 100));
}
