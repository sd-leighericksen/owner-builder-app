import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import * as s from "@/lib/validation/schemas";

/**
 * OpenAPI 3.1 spec generated from the same Zod schemas that validate the API
 * boundary (brief §2.1). Served at /api/v1/openapi.json; also writable to disk
 * via `pnpm openapi` for contract tests and client generation.
 */
export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "apiKey", {
    type: "http",
    scheme: "bearer",
    description: "API key (ob_...) or Supabase session. Machine access uses scoped, revocable API keys.",
  });

  // Schemas that only appear via .omit(projectId) in path bodies still get
  // published as named components for client generation.
  registry.register("TaskCreate", s.taskCreate);
  registry.register("QuoteCreate", s.quoteCreate);
  registry.register("BudgetCategoryCreate", s.budgetCategoryCreate);
  registry.register("TransactionCreate", s.transactionCreate);
  registry.register("VariationCreate", s.variationCreate);
  registry.register("DiaryEntryCreate", s.diaryEntryCreate);
  registry.register("InspectionCreate", s.inspectionCreate);

  const idParam = (name: string) =>
    registry.registerParameter(
      name,
      z.string().uuid().openapi({ param: { name, in: "path", required: true } }),
    );

  const projectId = idParam("projectId");
  const taskId = idParam("taskId");
  const contactId = idParam("contactId");
  const quoteId = idParam("quoteId");
  const documentId = idParam("documentId");

  const listOf = (schema: z.ZodTypeAny) => z.object({ items: z.array(schema) });
  const anyRecord = z.record(z.unknown());

  const jsonBody = (schema: z.ZodTypeAny) => ({
    content: { "application/json": { schema } },
  });
  const jsonResponse = (description: string, schema: z.ZodTypeAny) => ({
    description,
    content: { "application/json": { schema } },
  });

  // Projects
  registry.registerPath({
    method: "get", path: "/api/v1/projects", tags: ["projects"],
    summary: "List projects",
    responses: { 200: jsonResponse("Projects", listOf(anyRecord)) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/projects", tags: ["projects"],
    summary: "Create a project (wizard: seeds stages, budget categories and compliance checklist by state)",
    request: { body: jsonBody(s.projectCreate) },
    responses: { 201: jsonResponse("Created project", anyRecord) },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/projects/{projectId}", tags: ["projects"],
    summary: "Get a project",
    request: { params: z.object({ projectId }) },
    responses: { 200: jsonResponse("Project", anyRecord) },
  });
  registry.registerPath({
    method: "patch", path: "/api/v1/projects/{projectId}", tags: ["projects"],
    summary: "Update a project",
    request: { params: z.object({ projectId }), body: jsonBody(s.projectUpdate) },
    responses: { 200: jsonResponse("Updated project", anyRecord) },
  });

  // Stages & tasks
  registry.registerPath({
    method: "get", path: "/api/v1/projects/{projectId}/stages", tags: ["stages"],
    summary: "List build stages",
    request: { params: z.object({ projectId }) },
    responses: { 200: jsonResponse("Stages", listOf(anyRecord)) },
  });
  registry.registerPath({
    method: "patch", path: "/api/v1/stages/{stageId}", tags: ["stages"],
    summary: "Update a stage",
    request: { params: z.object({ stageId: idParam("stageId") }), body: jsonBody(s.stageUpdate) },
    responses: { 200: jsonResponse("Updated stage", anyRecord) },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/projects/{projectId}/tasks", tags: ["tasks"],
    summary: "List tasks (filterable by stageId, status, assignedContactId)",
    request: { params: z.object({ projectId }) },
    responses: { 200: jsonResponse("Tasks with dependency warnings", listOf(anyRecord)) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/projects/{projectId}/tasks", tags: ["tasks"],
    summary: "Create a task",
    request: { params: z.object({ projectId }), body: jsonBody(s.taskCreate.omit({ projectId: true })) },
    responses: { 201: jsonResponse("Created task", anyRecord) },
  });
  registry.registerPath({
    method: "patch", path: "/api/v1/tasks/{taskId}", tags: ["tasks"],
    summary: "Update a task (status flow: todo / in_progress / blocked / done)",
    request: { params: z.object({ taskId }), body: jsonBody(s.taskUpdate) },
    responses: { 200: jsonResponse("Updated task", anyRecord) },
  });

  // Budget
  registry.registerPath({
    method: "get", path: "/api/v1/projects/{projectId}/budget", tags: ["budget"],
    summary: "Budget summary: budget vs committed (accepted quotes + approved variations) vs actual, contingency burn-down, GST",
    request: { params: z.object({ projectId }) },
    responses: { 200: jsonResponse("Budget summary", anyRecord) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/projects/{projectId}/budget-categories", tags: ["budget"],
    summary: "Create a budget category (cost code)",
    request: { params: z.object({ projectId }), body: jsonBody(s.budgetCategoryCreate.omit({ projectId: true })) },
    responses: { 201: jsonResponse("Created category", anyRecord) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/projects/{projectId}/transactions", tags: ["budget"],
    summary: "Record an actual cost (integer cents, GST-aware)",
    request: { params: z.object({ projectId }), body: jsonBody(s.transactionCreate.omit({ projectId: true })) },
    responses: { 201: jsonResponse("Created transaction", anyRecord) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/projects/{projectId}/variations", tags: ["budget"],
    summary: "Record a variation (approved variations adjust committed budget)",
    request: { params: z.object({ projectId }), body: jsonBody(s.variationCreate.omit({ projectId: true })) },
    responses: { 201: jsonResponse("Created variation", anyRecord) },
  });

  // Contacts & quotes
  registry.registerPath({
    method: "get", path: "/api/v1/contacts", tags: ["contacts"],
    summary: "List contacts with licences and insurances",
    responses: { 200: jsonResponse("Contacts", listOf(anyRecord)) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/contacts", tags: ["contacts"],
    summary: "Create a contact (trade/supplier/consultant/surveyor/certifier)",
    request: { body: jsonBody(s.contactCreate) },
    responses: { 201: jsonResponse("Created contact", anyRecord) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/contacts/{contactId}/insurances", tags: ["contacts"],
    summary: "Add an insurance policy to a contact (expiry drives alerts)",
    request: { params: z.object({ contactId }), body: jsonBody(s.insuranceCreate) },
    responses: { 201: jsonResponse("Created insurance", anyRecord) },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/projects/{projectId}/quotes", tags: ["quotes"],
    summary: "List quotes; ?budgetCategoryId=&compare=true returns the side-by-side comparison for a scope",
    request: { params: z.object({ projectId }) },
    responses: { 200: jsonResponse("Quotes", listOf(anyRecord)) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/projects/{projectId}/quotes", tags: ["quotes"],
    summary: "Create a quote with optional line items",
    request: { params: z.object({ projectId }), body: jsonBody(s.quoteCreate.omit({ projectId: true })) },
    responses: { 201: jsonResponse("Created quote", anyRecord) },
  });
  registry.registerPath({
    method: "patch", path: "/api/v1/quotes/{quoteId}", tags: ["quotes"],
    summary: "Update a quote (accepting a quote commits its amount against the budget category)",
    request: { params: z.object({ quoteId }), body: jsonBody(s.quoteUpdate) },
    responses: { 200: jsonResponse("Updated quote", anyRecord) },
  });

  // Documents
  registry.registerPath({
    method: "get", path: "/api/v1/documents", tags: ["documents"],
    summary: "Search/filter the document vault (projectId, category, stageId, taskId, contactId, search)",
    responses: { 200: jsonResponse("Documents", listOf(anyRecord)) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/documents", tags: ["documents"],
    summary: "Create a document — multipart/form-data with `file` + `meta` (JSON), or JSON metadata only",
    request: { body: jsonBody(s.documentCreate) },
    responses: { 201: jsonResponse("Created document", anyRecord) },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/documents/{documentId}/download", tags: ["documents"],
    summary: "Get a signed, time-limited download URL",
    request: { params: z.object({ documentId }) },
    responses: { 200: jsonResponse("Signed URL", z.object({ url: z.string() })) },
  });

  // Diary & photos
  registry.registerPath({
    method: "post", path: "/api/v1/projects/{projectId}/diary", tags: ["diary"],
    summary: "Create an immutable site diary entry (edits create revisions)",
    request: { params: z.object({ projectId }), body: jsonBody(s.diaryEntryCreate.omit({ projectId: true })) },
    responses: { 201: jsonResponse("Created entry", anyRecord) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/diary/{entryId}/revise", tags: ["diary"],
    summary: "Create a revision superseding a diary entry (original preserved)",
    request: { params: z.object({ entryId: idParam("entryId") }), body: jsonBody(s.diaryEntryRevise) },
    responses: { 201: jsonResponse("Revision", anyRecord) },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/projects/{projectId}/photos", tags: ["photos"],
    summary: "Photo timeline (chronological, filterable by stage)",
    request: { params: z.object({ projectId }) },
    responses: { 200: jsonResponse("Photos with signed URLs", listOf(anyRecord)) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/projects/{projectId}/photos", tags: ["photos"],
    summary: "Upload a photo — multipart: file (required), thumbnail (client-resized), caption, stageId, takenAt",
    request: { params: z.object({ projectId }) },
    responses: { 201: jsonResponse("Created photo", anyRecord) },
  });

  // Inspections
  registry.registerPath({
    method: "get", path: "/api/v1/projects/{projectId}/inspections", tags: ["inspections"],
    summary: "List inspections (VIC mandatory notification stages seeded at project creation)",
    request: { params: z.object({ projectId }) },
    responses: { 200: jsonResponse("Inspections", listOf(anyRecord)) },
  });
  registry.registerPath({
    method: "patch", path: "/api/v1/inspections/{inspectionId}", tags: ["inspections"],
    summary: "Update an inspection (book, complete, record outcome)",
    request: { params: z.object({ inspectionId: idParam("inspectionId") }), body: jsonBody(s.inspectionUpdate) },
    responses: { 200: jsonResponse("Updated inspection", anyRecord) },
  });

  // Dashboard, export, settings
  registry.registerPath({
    method: "get", path: "/api/v1/projects/{projectId}/dashboard", tags: ["dashboard"],
    summary: "Dashboard aggregate: current stage, next tasks, upcoming inspections, budget position, expiring items",
    request: { params: z.object({ projectId }) },
    responses: { 200: jsonResponse("Dashboard", anyRecord) },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/projects/{projectId}/export", tags: ["export"],
    summary: "Full project export as JSON — data is never trapped",
    request: { params: z.object({ projectId }) },
    responses: { 200: jsonResponse("Export", anyRecord) },
  });
  registry.registerPath({
    method: "patch", path: "/api/v1/settings/ai-task-configs/{taskType}", tags: ["settings"],
    summary: "Update the model for an AI task type (vision-required tasks reject non-vision models)",
    request: {
      params: z.object({ taskType: s.aiTaskTypeEnum.openapi({ param: { name: "taskType", in: "path" } }) }),
      body: jsonBody(s.aiTaskConfigUpdate),
    },
    responses: { 200: jsonResponse("Updated config", anyRecord) },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/api-keys", tags: ["settings"],
    summary: "Create a scoped API key (plaintext returned once)",
    request: { body: jsonBody(s.apiKeyCreate) },
    responses: { 201: jsonResponse("Created key", anyRecord) },
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Owner-Builder Project Management API",
      version: "1.0.0",
      description:
        "Versioned REST API for the Australian owner-builder project management app. All business logic lives behind this API; the web app is just the first client. Money is integer cents (AUD) with explicit GST fields. Compliance content is a checklist aid, not legal advice — verify with the VBA and your relevant building surveyor.",
    },
    servers: [{ url: "/" }],
    security: [{ apiKey: [] }],
  });
}
