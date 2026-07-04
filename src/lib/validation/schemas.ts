import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date YYYY-MM-DD")
  .openapi({ example: "2026-07-04", description: "ISO date (displayed as DD/MM/YYYY in the UI)" });

export const cents = z
  .number()
  .int()
  .safe()
  .openapi({ description: "Money as integer cents (AUD)", example: 125000 });

/** Money input: caller provides inc-GST or ex-GST cents; service derives the rest. */
export const moneyInput = z
  .object({
    amountExGst: cents.optional(),
    amountIncGst: cents.optional(),
    gstApplicable: z.boolean().default(true),
  })
  .refine((v) => v.amountExGst !== undefined || v.amountIncGst !== undefined, {
    message: "Provide amountExGst or amountIncGst",
  })
  .openapi("MoneyInput");

export const moneyOutput = z
  .object({
    amountExGst: cents,
    gstAmount: cents,
    amountIncGst: cents,
    gstApplicable: z.boolean(),
  })
  .openapi("Money");

export const uuid = z.string().uuid();

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const auStateEnum = z.enum(["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);
export const projectStatusEnum = z.enum(["planning", "active", "on_hold", "completed", "archived"]);

export const projectCreate = z
  .object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
    lotPlanDetails: z.string().max(500).optional(),
    state: auStateEnum.default("VIC"),
    ownerBuilderPermitNo: z.string().max(100).optional(),
    buildingPermitNo: z.string().max(100).optional(),
    startDate: isoDate.optional(),
    targetCompletionDate: isoDate.optional(),
    totalBudget: cents.default(0),
    contingencyAmount: cents.default(0),
    seedStages: z.boolean().default(true),
    seedBudgetCategories: z.boolean().default(true),
    seedChecklist: z.boolean().default(true),
  })
  .openapi("ProjectCreate");

export const projectUpdate = projectCreate
  .omit({ seedStages: true, seedBudgetCategories: true, seedChecklist: true })
  .partial()
  .extend({
    status: projectStatusEnum.optional(),
    relevantBuildingSurveyorId: uuid.nullable().optional(),
  })
  .openapi("ProjectUpdate");

// ---------------------------------------------------------------------------
// Stages & tasks
// ---------------------------------------------------------------------------

export const stageStatusEnum = z.enum(["not_started", "in_progress", "complete"]);
export const taskStatusEnum = z.enum(["todo", "in_progress", "blocked", "done"]);

export const stageUpdate = z
  .object({
    name: z.string().min(1).max(200).optional(),
    sequence: z.number().int().min(0).optional(),
    plannedStart: isoDate.nullable().optional(),
    plannedEnd: isoDate.nullable().optional(),
    actualStart: isoDate.nullable().optional(),
    actualEnd: isoDate.nullable().optional(),
    status: stageStatusEnum.optional(),
  })
  .openapi("StageUpdate");

export const taskCreate = z
  .object({
    projectId: uuid,
    stageId: uuid.nullable().optional(),
    title: z.string().min(1).max(300),
    description: z.string().max(5000).optional(),
    status: taskStatusEnum.default("todo"),
    dueDate: isoDate.nullable().optional(),
    assignedContactId: uuid.nullable().optional(),
    isComplianceItem: z.boolean().default(false),
    dependsOnTaskIds: z.array(uuid).default([]),
  })
  .openapi("TaskCreate");

export const taskUpdate = taskCreate.omit({ projectId: true }).partial().extend({
  sortOrder: z.number().int().optional(),
}).openapi("TaskUpdate");

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const contactTypeEnum = z.enum(["trade", "supplier", "consultant", "surveyor", "certifier", "inspector", "other"]);
export const insuranceTypeEnum = z.enum(["public_liability", "workers_comp", "professional_indemnity", "construction_works", "domestic_building", "other"]);

export const contactCreate = z
  .object({
    type: contactTypeEnum.default("trade"),
    businessName: z.string().min(1).max(300),
    contactPerson: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().email().max(320).optional().or(z.literal("")),
    tradeCategory: z.string().max(100).optional(),
    licenceNumber: z.string().max(100).optional(),
    licenceType: z.string().max(100).optional(),
    licenceExpiry: isoDate.nullable().optional(),
    notes: z.string().max(5000).optional(),
  })
  .openapi("ContactCreate");

export const contactUpdate = contactCreate.partial().openapi("ContactUpdate");

export const insuranceCreate = z
  .object({
    type: insuranceTypeEnum,
    insurer: z.string().max(200).optional(),
    policyNumber: z.string().max(100).optional(),
    expiryDate: isoDate.nullable().optional(),
    certificateDocumentId: uuid.nullable().optional(),
  })
  .openapi("ContactInsuranceCreate");

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export const quoteStatusEnum = z.enum(["requested", "received", "accepted", "declined"]);

export const quoteLineItemInput = z
  .object({
    description: z.string().min(1).max(1000),
    qty: z.string().max(50).optional(),
    unit: z.string().max(50).optional(),
    unitPriceCents: cents.nullable().optional(),
    money: moneyInput,
  })
  .openapi("QuoteLineItemInput");

export const quoteCreate = z
  .object({
    projectId: uuid,
    contactId: uuid,
    budgetCategoryId: uuid.nullable().optional(),
    scopeOfWork: z.string().max(5000).optional(),
    status: quoteStatusEnum.default("requested"),
    money: moneyInput.optional(),
    validUntil: isoDate.nullable().optional(),
    documentId: uuid.nullable().optional(),
    notes: z.string().max(5000).optional(),
    lineItems: z.array(quoteLineItemInput).default([]),
  })
  .openapi("QuoteCreate");

export const quoteUpdate = quoteCreate.omit({ projectId: true, lineItems: true }).partial().openapi("QuoteUpdate");

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export const budgetCategoryCreate = z
  .object({
    projectId: uuid,
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(200),
    budgetAmount: cents.default(0),
    isContingency: z.boolean().default(false),
  })
  .openapi("BudgetCategoryCreate");

export const budgetCategoryUpdate = budgetCategoryCreate.omit({ projectId: true }).partial().openapi("BudgetCategoryUpdate");

export const transactionTypeEnum = z.enum(["invoice", "receipt", "deposit", "refund"]);
export const paymentStatusEnum = z.enum(["unpaid", "part_paid", "paid", "reimbursed"]);

export const transactionCreate = z
  .object({
    projectId: uuid,
    budgetCategoryId: uuid.nullable().optional(),
    contactId: uuid.nullable().optional(),
    description: z.string().min(1).max(1000),
    transactionDate: isoDate,
    money: moneyInput,
    type: transactionTypeEnum.default("invoice"),
    paymentStatus: paymentStatusEnum.default("unpaid"),
    documentId: uuid.nullable().optional(),
  })
  .openapi("TransactionCreate");

export const transactionUpdate = transactionCreate.omit({ projectId: true }).partial().openapi("TransactionUpdate");

export const variationStatusEnum = z.enum(["proposed", "approved", "rejected"]);

export const variationCreate = z
  .object({
    projectId: uuid,
    budgetCategoryId: uuid.nullable().optional(),
    description: z.string().min(1).max(1000),
    reason: z.string().max(2000).optional(),
    money: moneyInput, // signed delta; positive = cost increase
    status: variationStatusEnum.default("proposed"),
    variationDate: isoDate.optional(),
  })
  .openapi("VariationCreate");

export const variationUpdate = variationCreate.omit({ projectId: true }).partial().openapi("VariationUpdate");

// ---------------------------------------------------------------------------
// Documents, diary, photos, inspections
// ---------------------------------------------------------------------------

export const documentCategoryEnum = z.enum([
  "permit", "plan", "engineering", "compliance_certificate", "insurance", "contract",
  "quote", "invoice_receipt", "warranty", "correspondence", "photo", "other",
]);

export const documentCreate = z
  .object({
    projectId: uuid.nullable().optional(),
    title: z.string().min(1).max(300),
    category: documentCategoryEnum.default("other"),
    stageId: uuid.nullable().optional(),
    taskId: uuid.nullable().optional(),
    contactId: uuid.nullable().optional(),
    notes: z.string().max(5000).optional(),
    expiryDate: isoDate.nullable().optional(),
  })
  .openapi("DocumentCreate");

export const documentUpdate = documentCreate.partial().openapi("DocumentUpdate");

export const diaryEntryCreate = z
  .object({
    projectId: uuid,
    entryDate: isoDate,
    weather: z.string().max(200).optional(),
    notes: z.string().max(10000).optional(),
    peopleOnSite: z.string().max(2000).optional(),
    entryType: z.enum(["general", "incident", "delivery"]).default("general"),
    photoIds: z.array(uuid).default([]),
  })
  .openapi("DiaryEntryCreate");

/** Diary entries are immutable — a revision supersedes the original. */
export const diaryEntryRevise = diaryEntryCreate.omit({ projectId: true }).partial().openapi("DiaryEntryRevise");

export const inspectionOutcomeEnum = z.enum(["pass", "fail", "conditional"]);

export const inspectionUpdate = z
  .object({
    stageId: uuid.nullable().optional(),
    bookedDate: isoDate.nullable().optional(),
    completedDate: isoDate.nullable().optional(),
    outcome: inspectionOutcomeEnum.nullable().optional(),
    inspectorContactId: uuid.nullable().optional(),
    notes: z.string().max(5000).optional(),
    evidenceDocumentIds: z.array(uuid).optional(),
  })
  .openapi("InspectionUpdate");

export const inspectionCreate = inspectionUpdate
  .extend({
    projectId: uuid,
    type: z.string().min(1).max(300),
    required: z.boolean().default(false),
  })
  .openapi("InspectionCreate");

// ---------------------------------------------------------------------------
// AI task configs (registry only in Phase 1)
// ---------------------------------------------------------------------------

export const aiTaskTypeEnum = z.enum(["quote_extraction", "receipt_capture", "risk_review", "ask_the_build"]);

export const aiTaskConfigUpdate = z
  .object({
    modelId: z.string().min(1).max(200).optional(),
    fallbackModelId: z.string().max(200).nullable().optional(),
    maxTokens: z.number().int().min(256).max(200000).optional(),
    temperature: z
      .string()
      .regex(/^\d(\.\d+)?$/)
      .optional(),
    systemPromptOverride: z.string().max(20000).nullable().optional(),
  })
  .openapi("AiTaskConfigUpdate");

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export const apiKeyCreate = z
  .object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.string()).default([]),
  })
  .openapi("ApiKeyCreate");
