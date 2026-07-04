import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  boolean,
  bigint,
  integer,
  pgEnum,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Conventions (Section 4 of the brief):
// - id: UUID v7 generated in the app layer
// - every domain table: account_id, created_at, updated_at, deleted_at, created_by
// - money: integer cents — amount_ex_gst, gst_amount, gst_applicable
// ---------------------------------------------------------------------------

export const auState = pgEnum("au_state", ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);
export const memberRole = pgEnum("member_role", ["owner", "admin", "member", "readonly"]);
export const projectStatus = pgEnum("project_status", ["planning", "active", "on_hold", "completed", "archived"]);
export const stageStatus = pgEnum("stage_status", ["not_started", "in_progress", "complete"]);
export const taskStatus = pgEnum("task_status", ["todo", "in_progress", "blocked", "done"]);
export const contactType = pgEnum("contact_type", ["trade", "supplier", "consultant", "surveyor", "certifier", "inspector", "other"]);
export const insuranceType = pgEnum("insurance_type", ["public_liability", "workers_comp", "professional_indemnity", "construction_works", "domestic_building", "other"]);
export const quoteStatus = pgEnum("quote_status", ["requested", "received", "accepted", "declined"]);
export const transactionType = pgEnum("transaction_type", ["invoice", "receipt", "deposit", "refund"]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "part_paid", "paid", "reimbursed"]);
export const variationStatus = pgEnum("variation_status", ["proposed", "approved", "rejected"]);
export const documentCategory = pgEnum("document_category", [
  "permit", "plan", "engineering", "compliance_certificate", "insurance", "contract",
  "quote", "invoice_receipt", "warranty", "correspondence", "photo", "other",
]);
export const inspectionOutcome = pgEnum("inspection_outcome", ["pass", "fail", "conditional"]);
export const defectStatus = pgEnum("defect_status", ["open", "in_progress", "resolved", "closed"]);
export const selectionStatus = pgEnum("selection_status", ["open", "decided", "ordered", "installed"]);
export const aiTaskType = pgEnum("ai_task_type", ["quote_extraction", "receipt_capture", "risk_review", "ask_the_build"]);
export const aiOutcome = pgEnum("ai_outcome", ["success", "error"]);
export const webhookEventType = pgEnum("webhook_event_type", [
  "task.due", "inspection.due", "insurance.expiring", "budget.threshold", "document.added",
]);

// Common columns for every tenant-scoped domain table.
const tenantColumns = {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
};

// Money columns: integer cents only. inc-GST is derivable (ex + gst).
const moneyColumns = {
  amountExGst: bigint("amount_ex_gst", { mode: "number" }).notNull().default(0),
  gstAmount: bigint("gst_amount", { mode: "number" }).notNull().default(0),
  gstApplicable: boolean("gst_applicable").notNull().default(true),
};

// --- Tenancy -----------------------------------------------------------------

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const accountMembers = pgTable(
  "account_members",
  {
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    userId: uuid("user_id").notNull(), // Supabase auth.users id
    role: memberRole("role").notNull().default("member"),
    displayName: text("display_name"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.userId] })],
);

// Machine access (n8n etc). Store only a SHA-256 hash of the key.
export const apiKeys = pgTable("api_keys", {
  ...tenantColumns,
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  prefix: text("prefix").notNull(), // first 8 chars, for identification
  scopes: text("scopes").array().notNull().default([]),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// --- Core project entities ---------------------------------------------------

export const projects = pgTable("projects", {
  ...tenantColumns,
  name: text("name").notNull(),
  address: text("address").notNull(),
  lotPlanDetails: text("lot_plan_details"),
  state: auState("state").notNull().default("VIC"),
  ownerBuilderPermitNo: text("owner_builder_permit_no"), // VIC: Certificate of Consent number
  buildingPermitNo: text("building_permit_no"),
  relevantBuildingSurveyorId: uuid("relevant_building_surveyor_id"), // contacts.id
  startDate: date("start_date"),
  targetCompletionDate: date("target_completion_date"),
  totalBudget: bigint("total_budget", { mode: "number" }).notNull().default(0), // cents inc GST
  contingencyAmount: bigint("contingency_amount", { mode: "number" }).notNull().default(0),
  status: projectStatus("status").notNull().default("planning"),
}, (t) => [index("projects_account_idx").on(t.accountId)]);

export const stages = pgTable("stages", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull(),
  plannedStart: date("planned_start"),
  plannedEnd: date("planned_end"),
  actualStart: date("actual_start"),
  actualEnd: date("actual_end"),
  status: stageStatus("status").notNull().default("not_started"),
}, (t) => [index("stages_project_idx").on(t.projectId)]);

export const tasks = pgTable("tasks", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  stageId: uuid("stage_id").references(() => stages.id),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatus("status").notNull().default("todo"),
  dueDate: date("due_date"),
  assignedContactId: uuid("assigned_contact_id"),
  isComplianceItem: boolean("is_compliance_item").notNull().default(false),
  sourceTemplateItemId: uuid("source_template_item_id"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("tasks_project_idx").on(t.projectId), index("tasks_stage_idx").on(t.stageId)]);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    taskId: uuid("task_id").notNull().references(() => tasks.id),
    dependsOnTaskId: uuid("depends_on_task_id").notNull().references(() => tasks.id),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.dependsOnTaskId] })],
);

// --- Contacts & quotes --------------------------------------------------------

export const contacts = pgTable("contacts", {
  ...tenantColumns,
  type: contactType("type").notNull().default("trade"),
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  tradeCategory: text("trade_category"),
  licenceNumber: text("licence_number"),
  licenceType: text("licence_type"),
  licenceExpiry: date("licence_expiry"),
  notes: text("notes"),
}, (t) => [index("contacts_account_idx").on(t.accountId)]);

export const contactInsurances = pgTable("contact_insurances", {
  ...tenantColumns,
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  type: insuranceType("type").notNull(),
  insurer: text("insurer"),
  policyNumber: text("policy_number"),
  expiryDate: date("expiry_date"),
  certificateDocumentId: uuid("certificate_document_id"),
});

export const quotes = pgTable("quotes", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  budgetCategoryId: uuid("budget_category_id"),
  scopeOfWork: text("scope_of_work"),
  status: quoteStatus("status").notNull().default("requested"),
  ...moneyColumns,
  validUntil: date("valid_until"),
  documentId: uuid("document_id"),
  notes: text("notes"),
}, (t) => [index("quotes_project_idx").on(t.projectId)]);

export const quoteLineItems = pgTable("quote_line_items", {
  ...tenantColumns,
  quoteId: uuid("quote_id").notNull().references(() => quotes.id),
  description: text("description").notNull(),
  qty: text("qty"), // free-form quantity as quoted ("12", "3.5")
  unit: text("unit"),
  unitPriceCents: bigint("unit_price_cents", { mode: "number" }),
  ...moneyColumns,
  sortOrder: integer("sort_order").notNull().default(0),
});

// --- Budget ---------------------------------------------------------------------

export const budgetCategories = pgTable("budget_categories", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  budgetAmount: bigint("budget_amount", { mode: "number" }).notNull().default(0), // cents inc GST
  isContingency: boolean("is_contingency").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("budget_categories_project_idx").on(t.projectId)]);

export const transactions = pgTable("transactions", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  budgetCategoryId: uuid("budget_category_id").references(() => budgetCategories.id),
  contactId: uuid("contact_id"),
  description: text("description").notNull(),
  transactionDate: date("transaction_date").notNull(),
  ...moneyColumns,
  type: transactionType("type").notNull().default("invoice"),
  paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
  documentId: uuid("document_id"),
}, (t) => [index("transactions_project_idx").on(t.projectId)]);

export const variations = pgTable("variations", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  budgetCategoryId: uuid("budget_category_id").references(() => budgetCategories.id),
  description: text("description").notNull(),
  reason: text("reason"),
  // Signed delta in cents: positive = cost increase.
  ...moneyColumns,
  status: variationStatus("status").notNull().default("proposed"),
  variationDate: date("variation_date"),
}, (t) => [index("variations_project_idx").on(t.projectId)]);

// --- Documents, diary, photos ------------------------------------------------

export const documents = pgTable("documents", {
  ...tenantColumns,
  projectId: uuid("project_id").references(() => projects.id),
  title: text("title").notNull(),
  category: documentCategory("category").notNull().default("other"),
  stageId: uuid("stage_id"),
  taskId: uuid("task_id"),
  contactId: uuid("contact_id"),
  storagePath: text("storage_path"), // Supabase Storage object path
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  fileSize: bigint("file_size", { mode: "number" }),
  notes: text("notes"),
  expiryDate: date("expiry_date"), // drives alerts (insurances, permits)
}, (t) => [index("documents_project_idx").on(t.projectId)]);

export const inspections = pgTable("inspections", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  stageId: uuid("stage_id"),
  type: text("type").notNull(), // e.g. "Prior to placing footings"
  required: boolean("required").notNull().default(false),
  bookedDate: date("booked_date"),
  completedDate: date("completed_date"),
  outcome: inspectionOutcome("outcome"),
  inspectorContactId: uuid("inspector_contact_id"),
  notes: text("notes"),
  evidenceDocumentIds: uuid("evidence_document_ids").array(),
  sourceTemplateItemId: uuid("source_template_item_id"),
}, (t) => [index("inspections_project_idx").on(t.projectId)]);

// Diary entries are immutable once created; edits create revisions pointing at
// the original via revision_of_id (Section 7.2).
export const diaryEntries = pgTable("diary_entries", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  entryDate: date("entry_date").notNull(),
  weather: text("weather"),
  notes: text("notes"),
  peopleOnSite: text("people_on_site"),
  entryType: text("entry_type").notNull().default("general"), // general | incident | delivery
  revisionOfId: uuid("revision_of_id"),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
}, (t) => [index("diary_project_idx").on(t.projectId)]);

export const photos = pgTable("photos", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  diaryEntryId: uuid("diary_entry_id"),
  stageId: uuid("stage_id"),
  storagePath: text("storage_path"),
  thumbnailPath: text("thumbnail_path"),
  caption: text("caption"),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  exif: jsonb("exif"),
}, (t) => [index("photos_project_idx").on(t.projectId)]);

// --- Phase 2 domain (tables only; features ship in Phase 2) -------------------

export const defects = pgTable("defects", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  description: text("description").notNull(),
  location: text("location"),
  photoIds: uuid("photo_ids").array(),
  assignedContactId: uuid("assigned_contact_id"),
  status: defectStatus("status").notNull().default("open"),
  raisedDate: date("raised_date"),
  resolvedDate: date("resolved_date"),
});

export const selections = pgTable("selections", {
  ...tenantColumns,
  projectId: uuid("project_id").notNull().references(() => projects.id),
  item: text("item").notNull(),
  optionsConsidered: text("options_considered"),
  decision: text("decision"),
  supplierContactId: uuid("supplier_contact_id"),
  costImpactCents: bigint("cost_impact_cents", { mode: "number" }),
  documentIds: uuid("document_ids").array(),
  status: selectionStatus("status").notNull().default("open"),
});

// --- Jurisdiction content (state as data, not code) ---------------------------

export const stageTemplates = pgTable("stage_templates", {
  id: uuid("id").primaryKey(),
  state: auState("state").notNull(),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checklistTemplates = pgTable("checklist_templates", {
  id: uuid("id").primaryKey(),
  state: auState("state").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checklistTemplateItems = pgTable("checklist_template_items", {
  id: uuid("id").primaryKey(),
  checklistTemplateId: uuid("checklist_template_id").notNull().references(() => checklistTemplates.id),
  appliesToStage: text("applies_to_stage"), // matches stage template name; null = project-wide
  title: text("title").notNull(),
  description: text("description"),
  helpUrl: text("help_url"),
  required: boolean("required").notNull().default(false),
  itemKind: text("item_kind").notNull().default("task"), // task | inspection | document
  sourceUrl: text("source_url"),
  lastVerifiedAt: date("last_verified_at"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// --- AI config & usage (registry only in Phase 1; features are Phase 3) -------

export const aiTaskConfigs = pgTable("ai_task_configs", {
  ...tenantColumns,
  taskType: aiTaskType("task_type").notNull(),
  modelId: text("model_id").notNull(),
  fallbackModelId: text("fallback_model_id"),
  requiresVision: boolean("requires_vision").notNull().default(false),
  maxTokens: integer("max_tokens").notNull().default(4096),
  temperature: text("temperature").notNull().default("0.2"),
  systemPromptOverride: text("system_prompt_override"),
});

export const aiUsageLog = pgTable("ai_usage_log", {
  ...tenantColumns,
  taskType: aiTaskType("task_type").notNull(),
  modelUsed: text("model_used").notNull(),
  relatedRecordType: text("related_record_type"),
  relatedRecordId: uuid("related_record_id"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  reportedCostMicros: bigint("reported_cost_micros", { mode: "number" }), // USD micro-dollars
  latencyMs: integer("latency_ms"),
  outcome: aiOutcome("outcome").notNull(),
  errorMessage: text("error_message"),
});

// --- Events, jobs, audit -------------------------------------------------------

export const webhookEndpoints = pgTable("webhook_endpoints", {
  ...tenantColumns,
  url: text("url").notNull(),
  eventTypes: text("event_types").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
});

export const webhookEvents = pgTable("webhook_events", {
  ...tenantColumns,
  eventType: webhookEventType("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
}, (t) => [index("webhook_events_account_idx").on(t.accountId)]);

export const notifications = pgTable("notifications", {
  ...tenantColumns,
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull(),
  actorUserId: uuid("actor_user_id"),
  tableName: text("table_name").notNull(),
  recordId: uuid("record_id").notNull(),
  action: text("action").notNull(), // insert | update | soft_delete
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_account_idx").on(t.accountId), index("audit_record_idx").on(t.recordId)]);
