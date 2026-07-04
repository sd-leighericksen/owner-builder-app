import { describe, it, expect } from "vitest";
import { computeBudgetSummary } from "@/lib/services/budget-math";

const cat = (id: string, budget: number, isContingency = false) => ({
  id,
  code: id,
  name: `Category ${id}`,
  budgetAmount: budget,
  isContingency,
});

describe("budget summary (budget vs committed vs actual)", () => {
  it("actuals sum transactions per category; refunds subtract", () => {
    const summary = computeBudgetSummary(
      [cat("A", 100000)],
      [
        { budgetCategoryId: "A", type: "invoice", amountExGst: 10000, gstAmount: 1000 },
        { budgetCategoryId: "A", type: "receipt", amountExGst: 5000, gstAmount: 500 },
        { budgetCategoryId: "A", type: "refund", amountExGst: 2000, gstAmount: 200 },
      ],
      [],
      [],
    );
    const a = summary.categories[0];
    expect(a.actualExGst).toBe(13000);
    expect(a.actualGst).toBe(1300);
    expect(a.actualIncGst).toBe(14300);
    expect(a.remainingVsBudget).toBe(100000 - 14300);
  });

  it("committed = accepted quotes + approved variations only", () => {
    const summary = computeBudgetSummary(
      [cat("A", 500000)],
      [],
      [
        { budgetCategoryId: "A", status: "accepted", amountExGst: 100000, gstAmount: 10000 },
        { budgetCategoryId: "A", status: "received", amountExGst: 90000, gstAmount: 9000 }, // not committed
        { budgetCategoryId: "A", status: "declined", amountExGst: 80000, gstAmount: 8000 }, // not committed
      ],
      [
        { budgetCategoryId: "A", status: "approved", amountExGst: 20000, gstAmount: 2000 },
        { budgetCategoryId: "A", status: "proposed", amountExGst: 50000, gstAmount: 5000 }, // not committed
      ],
    );
    expect(summary.categories[0].committedIncGst).toBe(110000 + 22000);
  });

  it("contingency burn counts approved cost increases only", () => {
    const summary = computeBudgetSummary(
      [cat("A", 100000), cat("CONT", 50000, true)],
      [],
      [],
      [
        { budgetCategoryId: "A", status: "approved", amountExGst: 10000, gstAmount: 1000 },
        { budgetCategoryId: "A", status: "approved", amountExGst: -5000, gstAmount: -500 }, // saving: no refill
        { budgetCategoryId: "A", status: "proposed", amountExGst: 99999, gstAmount: 9999 }, // not approved
      ],
    );
    expect(summary.contingency.budgetIncGst).toBe(50000);
    expect(summary.contingency.consumedByVariationsIncGst).toBe(11000);
    expect(summary.contingency.remainingIncGst).toBe(39000);
  });

  it("flags percent consumed for the 90% alert threshold", () => {
    const summary = computeBudgetSummary(
      [cat("A", 10000), cat("B", 0)],
      [{ budgetCategoryId: "A", type: "invoice", amountExGst: 9000, gstAmount: 900 }],
      [],
      [],
    );
    expect(summary.categories[0].percentConsumed).toBeCloseTo(0.99);
    expect(summary.categories[1].percentConsumed).toBeNull(); // zero budget: no ratio
  });

  it("GST summary reports paid GST across all categories", () => {
    const summary = computeBudgetSummary(
      [cat("A", 0), cat("B", 0)],
      [
        { budgetCategoryId: "A", type: "invoice", amountExGst: 1000, gstAmount: 100 },
        { budgetCategoryId: "B", type: "invoice", amountExGst: 2000, gstAmount: 0 }, // GST-free
      ],
      [],
      [],
    );
    expect(summary.gst.paidGst).toBe(100);
    expect(summary.totals.actualExGst).toBe(3000);
  });
});
