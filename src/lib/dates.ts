/** All display dates are DD/MM/YYYY in Australia/Melbourne (brief §3). */

export const APP_TZ = "Australia/Melbourne";

const dmy = new Intl.DateTimeFormat("en-AU", {
  timeZone: APP_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Format an ISO date ("2026-07-04") or Date as DD/MM/YYYY. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  // Plain dates (no time component) must not be shifted by timezone.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return dmy.format(date);
}

/** Today's date in Melbourne as an ISO date string (YYYY-MM-DD). */
export function todayISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(new Date());
  return parts; // en-CA yields YYYY-MM-DD
}

/** Whole days from today (Melbourne) to the given ISO date. Negative = past. */
export function daysUntil(isoDate: string): number {
  const [y1, m1, d1] = todayISO().split("-").map(Number);
  const [y2, m2, d2] = isoDate.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}
