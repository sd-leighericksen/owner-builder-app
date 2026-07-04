/**
 * Money is ALWAYS integer cents (AUD). No floating point currency, ever.
 * Every money record stores amount_ex_gst + gst_amount; inc-GST is derived.
 * Australian GST rate: 10%.
 */

export const GST_RATE_NUMERATOR = 1;
export const GST_RATE_DENOMINATOR = 10; // GST = 10% of the ex-GST amount

export interface Money {
  amountExGst: number; // cents
  gstAmount: number; // cents
  gstApplicable: boolean;
}

function assertCents(value: number, label: string) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be integer cents, got ${value}`);
  }
}

/** inc-GST total in cents. */
export function incGst(m: Pick<Money, "amountExGst" | "gstAmount">): number {
  assertCents(m.amountExGst, "amountExGst");
  assertCents(m.gstAmount, "gstAmount");
  return m.amountExGst + m.gstAmount;
}

/**
 * Build a Money from an ex-GST amount. GST = 10% of ex-GST, rounded
 * half-up to the nearest cent (ATO-acceptable per-invoice rounding).
 */
export function fromExGst(amountExGst: number, gstApplicable = true): Money {
  assertCents(amountExGst, "amountExGst");
  const gstAmount = gstApplicable
    ? Math.round((amountExGst * GST_RATE_NUMERATOR) / GST_RATE_DENOMINATOR)
    : 0;
  return { amountExGst, gstAmount, gstApplicable };
}

/**
 * Build a Money from an inc-GST amount (how receipts are usually quoted).
 * GST component = 1/11 of the inc-GST total, rounded half-up.
 */
export function fromIncGst(amountIncGst: number, gstApplicable = true): Money {
  assertCents(amountIncGst, "amountIncGst");
  if (!gstApplicable) return { amountExGst: amountIncGst, gstAmount: 0, gstApplicable };
  const gstAmount = Math.round(amountIncGst / 11);
  return { amountExGst: amountIncGst - gstAmount, gstAmount, gstApplicable };
}

export function addMoney(a: Pick<Money, "amountExGst" | "gstAmount">, b: Pick<Money, "amountExGst" | "gstAmount">) {
  return {
    amountExGst: a.amountExGst + b.amountExGst,
    gstAmount: a.gstAmount + b.gstAmount,
  };
}

export function sumMoney(items: Array<Pick<Money, "amountExGst" | "gstAmount">>) {
  return items.reduce(addMoney, { amountExGst: 0, gstAmount: 0 });
}

/** Format cents as AUD, e.g. 123456 → "$1,234.56". Negative → "-$1,234.56". */
export function formatCents(cents: number): string {
  assertCents(cents, "cents");
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars.toLocaleString("en-AU")}.${remainder}`;
}

/** Parse a user-entered dollar string ("1,234.56", "$1234.5") to cents. */
export function parseDollarsToCents(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^-?\d*(\.\d{0,2})?$/.test(cleaned)) {
    throw new Error(`Invalid currency amount: "${input}"`);
  }
  const negative = cleaned.startsWith("-");
  const [whole = "0", frac = ""] = cleaned.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
  return negative ? -cents : cents;
}
