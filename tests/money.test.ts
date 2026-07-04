import { describe, it, expect } from "vitest";
import { fromExGst, fromIncGst, incGst, sumMoney, formatCents, parseDollarsToCents } from "@/lib/money";

describe("GST maths (integer cents only)", () => {
  it("adds 10% GST to an ex-GST amount", () => {
    expect(fromExGst(10000)).toEqual({ amountExGst: 10000, gstAmount: 1000, gstApplicable: true });
  });

  it("rounds GST half-up to the nearest cent", () => {
    // $1.05 ex GST → GST 10.5c → rounds to 11c
    expect(fromExGst(105).gstAmount).toBe(11);
    // $1.04 ex GST → GST 10.4c → rounds to 10c
    expect(fromExGst(104).gstAmount).toBe(10);
  });

  it("extracts 1/11 GST from an inc-GST amount", () => {
    const m = fromIncGst(11000);
    expect(m).toEqual({ amountExGst: 10000, gstAmount: 1000, gstApplicable: true });
    expect(incGst(m)).toBe(11000);
  });

  it("inc-GST split always reassembles exactly (no cent lost)", () => {
    for (const cents of [1, 3, 7, 99, 101, 999999, 123456789]) {
      const m = fromIncGst(cents);
      expect(m.amountExGst + m.gstAmount).toBe(cents);
    }
  });

  it("GST-free supplies carry zero GST", () => {
    expect(fromExGst(5000, false).gstAmount).toBe(0);
    expect(fromIncGst(5000, false)).toEqual({ amountExGst: 5000, gstAmount: 0, gstApplicable: false });
  });

  it("rejects non-integer cents", () => {
    expect(() => fromExGst(10.5)).toThrow();
    expect(() => incGst({ amountExGst: 1.1, gstAmount: 0 })).toThrow();
  });

  it("sums money without floating point", () => {
    const total = sumMoney([fromExGst(333), fromExGst(667), fromIncGst(11)]);
    expect(total.amountExGst).toBe(333 + 667 + 10);
    expect(total.gstAmount).toBe(33 + 67 + 1);
  });
});

describe("currency formatting (AUD)", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(-500)).toBe("-$5.00");
  });

  it("parses user dollar input to cents", () => {
    expect(parseDollarsToCents("1,234.56")).toBe(123456);
    expect(parseDollarsToCents("$12")).toBe(1200);
    expect(parseDollarsToCents("0.5")).toBe(50);
    expect(parseDollarsToCents("-3.25")).toBe(-325);
    expect(() => parseDollarsToCents("abc")).toThrow();
  });
});
