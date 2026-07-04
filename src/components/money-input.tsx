"use client";

import * as React from "react";
import { Input } from "@/components/ui";

/**
 * Dollar entry that yields integer cents. The user types dollars ("12,500.50");
 * we never store floats (brief §7.1).
 */
export function MoneyInput({
  valueCents,
  onChangeCents,
  placeholder = "0.00",
  id,
}: {
  valueCents: number | null;
  onChangeCents: (cents: number | null) => void;
  placeholder?: string;
  id?: string;
}) {
  const [text, setText] = React.useState(valueCents != null ? centsToText(valueCents) : "");

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">$</span>
      <Input
        id={id}
        inputMode="decimal"
        className="pl-7"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const cents = parseToCents(raw);
          onChangeCents(cents);
        }}
        onBlur={() => {
          const cents = parseToCents(text);
          if (cents != null) setText(centsToText(cents));
        }}
      />
    </div>
  );
}

function parseToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^-?\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "-" || cleaned === ".") return null;
  const negative = cleaned.startsWith("-");
  const [whole = "0", frac = ""] = cleaned.replace("-", "").split(".");
  const cents = Number(whole || "0") * 100 + Number((frac || "0").padEnd(2, "0").slice(0, 2));
  return negative ? -cents : cents;
}

function centsToText(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100).toLocaleString("en-AU")}.${String(abs % 100).padStart(2, "0")}`;
}
