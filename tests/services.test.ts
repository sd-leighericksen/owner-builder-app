/**
 * Service-layer tests against an embedded in-memory Postgres (PGlite) with the
 * real committed migrations applied — exercises project seeding, quote/budget
 * flows, diary immutability and the AI vision guard end to end.
 */
import { describe, it, expect, beforeAll } from "vitest";

process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DIR = "memory://";
process.env.AUTH_MODE = "dev";

import { seedJurisdictionContent, seedDevAccount, DEV_ACCOUNT_ID, DEV_USER_ID } from "@/db/seed";
import { createProject, listStages } from "@/lib/services/projects";
import { listTasks, createTask, updateTask } from "@/lib/services/tasks";
import { listCategories, createTransaction, createVariation, updateVariation, getBudgetSummary } from "@/lib/services/budget";
import { createContact } from "@/lib/services/contacts";
import { createQuote, updateQuote } from "@/lib/services/quotes";
import { listInspections } from "@/lib/services/inspections";
import { createDiaryEntry, reviseDiaryEntry, listDiaryEntries } from "@/lib/services/diary";
import { updateAiTaskConfig } from "@/lib/services/ai/config";
import { exportProject } from "@/lib/services/export";

const A = DEV_ACCOUNT_ID;
const U = DEV_USER_ID;
let projectId: string;

beforeAll(async () => {
  await seedJurisdictionContent();
  await seedDevAccount();
  const project = await createProject(A, U, {
    name: "Test build",
    address: "1 Test St, Melbourne VIC",
    state: "VIC",
    totalBudget: 80_000_000, // $800k
    contingencyAmount: 5_000_000, // $50k
    seedStages: true,
    seedBudgetCategories: true,
    seedChecklist: true,
  });
  projectId = project.id;
});

describe("project creation wizard seeding (state as data)", () => {
  it("seeds the VIC stage template in order", async () => {
    const stages = await listStages(A, projectId);
    expect(stages.length).toBe(11);
    expect(stages[0].name).toBe("Planning & Permits");
    expect(stages.at(-1)!.name).toBe("Completion & Handover");
    expect(stages.map((s) => s.sequence)).toEqual([...Array(11)].map((_, i) => i + 1));
  });

  it("seeds Australian residential budget categories with contingency", async () => {
    const cats = await listCategories(A, projectId);
    expect(cats.length).toBe(11);
    const contingency = cats.find((c) => c.isContingency);
    expect(contingency?.budgetAmount).toBe(5_000_000);
  });

  it("instantiates checklist items into compliance tasks with stage links", async () => {
    const tasks = await listTasks(A, projectId);
    const compliance = tasks.filter((t) => t.isComplianceItem);
    expect(compliance.length).toBeGreaterThanOrEqual(6);
    const consent = compliance.find((t) => t.title.includes("Certificate of Consent"));
    expect(consent).toBeDefined();
    expect(consent!.stageId).not.toBeNull();
  });

  it("instantiates the four VIC mandatory notification inspections", async () => {
    const inspections = await listInspections(A, projectId);
    const required = inspections.filter((i) => i.required);
    expect(required.length).toBe(4);
    expect(required.map((i) => i.type).join(" ")).toMatch(/footings/i);
  });
});

describe("budget flows", () => {
  it("accepted quotes and approved variations become committed", async () => {
    const cats = await listCategories(A, projectId);
    const frame = cats.find((c) => c.name === "Frame")!;
    const contact = await createContact(A, U, { type: "trade", businessName: "Frames R Us" });

    const quote = await createQuote(A, U, {
      projectId,
      contactId: contact.id,
      budgetCategoryId: frame.id,
      status: "received",
      money: { amountIncGst: 1_100_000, gstApplicable: true }, // $11,000
      lineItems: [],
    });
    let summary = await getBudgetSummary(A, projectId);
    expect(summary.categories.find((c) => c.id === frame.id)!.committedIncGst).toBe(0);

    await updateQuote(A, quote.id, { status: "accepted" });
    summary = await getBudgetSummary(A, projectId);
    expect(summary.categories.find((c) => c.id === frame.id)!.committedIncGst).toBe(1_100_000);

    const variation = await createVariation(A, U, {
      projectId,
      budgetCategoryId: frame.id,
      description: "Extra bracing",
      status: "proposed",
      money: { amountIncGst: 110_000, gstApplicable: true },
    });
    await updateVariation(A, U, variation.id, { status: "approved" });
    summary = await getBudgetSummary(A, projectId);
    expect(summary.categories.find((c) => c.id === frame.id)!.committedIncGst).toBe(1_210_000);
    expect(summary.contingency.consumedByVariationsIncGst).toBe(110_000);
  });

  it("transactions record actuals with derived GST", async () => {
    const cats = await listCategories(A, projectId);
    const slab = cats.find((c) => c.name === "Slab & Footings")!;
    const txn = await createTransaction(A, U, {
      projectId,
      budgetCategoryId: slab.id,
      description: "Slab pour deposit",
      transactionDate: "2026-07-01",
      type: "deposit",
      paymentStatus: "paid",
      money: { amountIncGst: 550_000, gstApplicable: true },
    });
    expect(txn.amountExGst).toBe(500_000);
    expect(txn.gstAmount).toBe(50_000);
    const summary = await getBudgetSummary(A, projectId);
    expect(summary.categories.find((c) => c.id === slab.id)!.actualIncGst).toBe(550_000);
  });
});

describe("task status flow and dependencies", () => {
  it("tracks dependency warnings until the blocker is done", async () => {
    const first = await createTask(A, U, { projectId, title: "Order trusses", status: "todo", isComplianceItem: false, dependsOnTaskIds: [] });
    const second = await createTask(A, U, {
      projectId, title: "Install trusses", status: "todo", isComplianceItem: false, dependsOnTaskIds: [first.id],
    });
    let tasks = await listTasks(A, projectId);
    expect(tasks.find((t) => t.id === second.id)!.blockedByOpenDependencies).toEqual(["Order trusses"]);

    await updateTask(A, first.id, { status: "done" });
    tasks = await listTasks(A, projectId);
    expect(tasks.find((t) => t.id === second.id)!.blockedByOpenDependencies).toEqual([]);
  });
});

describe("diary immutability (audit-grade records)", () => {
  it("revising an entry supersedes it and preserves the original", async () => {
    const entry = await createDiaryEntry(A, U, {
      projectId, entryDate: "2026-07-02", notes: "Sparky on site", entryType: "general", photoIds: [],
    });
    const revision = await reviseDiaryEntry(A, U, entry.id, { notes: "Sparky and plumber on site" });
    expect(revision.revisionOfId).toBe(entry.id);

    const current = await listDiaryEntries(A, projectId);
    expect(current.some((e) => e.id === entry.id)).toBe(false); // superseded hidden
    expect(current.some((e) => e.id === revision.id)).toBe(true);

    const all = await listDiaryEntries(A, projectId, true);
    const original = all.find((e) => e.id === entry.id)!;
    expect(original.notes).toBe("Sparky on site"); // untouched
    expect(original.supersededAt).not.toBeNull();
  });
});

describe("AI task config vision guard", () => {
  it("rejects assigning a non-vision model to a vision task", async () => {
    await expect(
      updateAiTaskConfig(A, "quote_extraction", { modelId: "deepseek/deepseek-r1" }),
    ).rejects.toThrow(/vision/i);
  });

  it("accepts a vision-capable model", async () => {
    const updated = await updateAiTaskConfig(A, "quote_extraction", { modelId: "openai/gpt-4o" });
    expect(updated.modelId).toBe("openai/gpt-4o");
  });
});

describe("export", () => {
  it("exports the full project graph", async () => {
    const data = await exportProject(A, projectId);
    expect(data.project.id).toBe(projectId);
    expect(data.stages.length).toBe(11);
    expect(data.budgetCategories.length).toBe(11);
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.inspections.length).toBeGreaterThanOrEqual(4);
    expect(data.formatVersion).toBe(1);
  });
});
