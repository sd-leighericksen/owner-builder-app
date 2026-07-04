import type { z } from "zod";
import { fromExGst, fromIncGst, type Money } from "@/lib/money";
import type { moneyInput } from "@/lib/validation/schemas";

/** Resolve a MoneyInput (ex-GST or inc-GST cents) into stored Money fields. */
export function resolveMoney(input: z.infer<typeof moneyInput>): Money {
  if (input.amountExGst !== undefined) {
    return fromExGst(input.amountExGst, input.gstApplicable);
  }
  return fromIncGst(input.amountIncGst!, input.gstApplicable);
}

export function moneyView(row: { amountExGst: number; gstAmount: number; gstApplicable: boolean }) {
  return {
    amountExGst: row.amountExGst,
    gstAmount: row.gstAmount,
    amountIncGst: row.amountExGst + row.gstAmount,
    gstApplicable: row.gstApplicable,
  };
}
