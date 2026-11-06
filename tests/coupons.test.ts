import { describe, expect, it } from "vitest";
import { couponProblem, discountedCents, normalizeCouponCode } from "@/modules/coupons/rules";

const base = { code: "CONTESTATESTE", percentOff: 100, maxUses: null, usedCount: 0, validUntil: null, active: true };

describe("cupões", () => {
  it("normaliza o código", () => {
    expect(normalizeCouponCode("  contesta teste ")).toBe("CONTESTATESTE");
  });
  it("calcula o desconto", () => {
    expect(discountedCents(2900, 100)).toBe(0);
    expect(discountedCents(2900, 50)).toBe(1450);
    expect(discountedCents(2999, 10)).toBe(2699);
    expect(discountedCents(2900, 0)).toBe(2900);
    expect(discountedCents(2900, null)).toBe(2900);
    expect(discountedCents(2900, 150)).toBe(0);
  });
  it("valida estado, validade e limite", () => {
    expect(couponProblem(base)).toBeNull();
    expect(couponProblem(null)).toMatch(/inválido/);
    expect(couponProblem({ ...base, active: false })).toMatch(/inválido/);
    expect(couponProblem({ ...base, validUntil: new Date("2020-01-01") })).toMatch(/expirou/);
    expect(couponProblem({ ...base, maxUses: 3, usedCount: 3 })).toMatch(/limite/);
    expect(couponProblem({ ...base, maxUses: 3, usedCount: 2 })).toBeNull();
  });
});
