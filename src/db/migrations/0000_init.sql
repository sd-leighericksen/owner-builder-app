CREATE TYPE "public"."ai_outcome" AS ENUM('success', 'error');--> statement-breakpoint
CREATE TYPE "public"."ai_task_type" AS ENUM('quote_extraction', 'receipt_capture', 'risk_review', 'ask_the_build');--> statement-breakpoint
CREATE TYPE "public"."au_state" AS ENUM('VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('trade', 'supplier', 'consultant', 'surveyor', 'certifier', 'inspector', 'other');--> statement-breakpoint
CREATE TYPE "public"."defect_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('permit', 'plan', 'engineering', 'compliance_certificate', 'insurance', 'contract', 'quote', 'invoice_receipt', 'warranty', 'correspondence', 'photo', 'other');--> statement-breakpoint
CREATE TYPE "public"."inspection_outcome" AS ENUM('pass', 'fail', 'conditional');--> statement-breakpoint
CREATE TYPE "public"."insurance_type" AS ENUM('public_liability', 'workers_comp', 'professional_indemnity', 'construction_works', 'domestic_building', 'other');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member', 'readonly');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'part_paid', 'paid', 'reimbursed');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('requested', 'received', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."selection_status" AS ENUM('open', 'decided', 'ordered', 'installed');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('not_started', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'blocked', 'done');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('invoice', 'receipt', 'deposit', 'refund');--> statement-breakpoint
CREATE TYPE "public"."variation_status" AS ENUM('proposed', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_type" AS ENUM('task.due', 'inspection.due', 'insurance.expiring', 'budget.threshold', 'document.added');--> statement-breakpoint
CREATE TABLE "account_members" (
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"display_name" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_members_account_id_user_id_pk" PRIMARY KEY("account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_task_configs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"task_type" "ai_task_type" NOT NULL,
	"model_id" text NOT NULL,
	"fallback_model_id" text,
	"requires_vision" boolean DEFAULT false NOT NULL,
	"max_tokens" integer DEFAULT 4096 NOT NULL,
	"temperature" text DEFAULT '0.2' NOT NULL,
	"system_prompt_override" text
);
--> statement-breakpoint
CREATE TABLE "ai_usage_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"task_type" "ai_task_type" NOT NULL,
	"model_used" text NOT NULL,
	"related_record_type" text,
	"related_record_id" uuid,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"reported_cost_micros" bigint,
	"latency_ms" integer,
	"outcome" "ai_outcome" NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"action" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"budget_amount" bigint DEFAULT 0 NOT NULL,
	"is_contingency" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_template_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"checklist_template_id" uuid NOT NULL,
	"applies_to_stage" text,
	"title" text NOT NULL,
	"description" text,
	"help_url" text,
	"required" boolean DEFAULT false NOT NULL,
	"item_kind" text DEFAULT 'task' NOT NULL,
	"source_url" text,
	"last_verified_at" date,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"state" "au_state" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_insurances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"contact_id" uuid NOT NULL,
	"type" "insurance_type" NOT NULL,
	"insurer" text,
	"policy_number" text,
	"expiry_date" date,
	"certificate_document_id" uuid
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"type" "contact_type" DEFAULT 'trade' NOT NULL,
	"business_name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"trade_category" text,
	"licence_number" text,
	"licence_type" text,
	"licence_expiry" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "defects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"description" text NOT NULL,
	"location" text,
	"photo_ids" uuid[],
	"assigned_contact_id" uuid,
	"status" "defect_status" DEFAULT 'open' NOT NULL,
	"raised_date" date,
	"resolved_date" date
);
--> statement-breakpoint
CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"weather" text,
	"notes" text,
	"people_on_site" text,
	"entry_type" text DEFAULT 'general' NOT NULL,
	"revision_of_id" uuid,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid,
	"title" text NOT NULL,
	"category" "document_category" DEFAULT 'other' NOT NULL,
	"stage_id" uuid,
	"task_id" uuid,
	"contact_id" uuid,
	"storage_path" text,
	"file_name" text,
	"mime_type" text,
	"file_size" bigint,
	"notes" text,
	"expiry_date" date
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"stage_id" uuid,
	"type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"booked_date" date,
	"completed_date" date,
	"outcome" "inspection_outcome",
	"inspector_contact_id" uuid,
	"notes" text,
	"evidence_document_ids" uuid[],
	"source_template_item_id" uuid
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"diary_entry_id" uuid,
	"stage_id" uuid,
	"storage_path" text,
	"thumbnail_path" text,
	"caption" text,
	"taken_at" timestamp with time zone,
	"exif" jsonb
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"lot_plan_details" text,
	"state" "au_state" DEFAULT 'VIC' NOT NULL,
	"owner_builder_permit_no" text,
	"building_permit_no" text,
	"relevant_building_surveyor_id" uuid,
	"start_date" date,
	"target_completion_date" date,
	"total_budget" bigint DEFAULT 0 NOT NULL,
	"contingency_amount" bigint DEFAULT 0 NOT NULL,
	"status" "project_status" DEFAULT 'planning' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"quote_id" uuid NOT NULL,
	"description" text NOT NULL,
	"qty" text,
	"unit" text,
	"unit_price_cents" bigint,
	"amount_ex_gst" bigint DEFAULT 0 NOT NULL,
	"gst_amount" bigint DEFAULT 0 NOT NULL,
	"gst_applicable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"budget_category_id" uuid,
	"scope_of_work" text,
	"status" "quote_status" DEFAULT 'requested' NOT NULL,
	"amount_ex_gst" bigint DEFAULT 0 NOT NULL,
	"gst_amount" bigint DEFAULT 0 NOT NULL,
	"gst_applicable" boolean DEFAULT true NOT NULL,
	"valid_until" date,
	"document_id" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "selections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"item" text NOT NULL,
	"options_considered" text,
	"decision" text,
	"supplier_contact_id" uuid,
	"cost_impact_cents" bigint,
	"document_ids" uuid[],
	"status" "selection_status" DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"state" "au_state" NOT NULL,
	"name" text NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sequence" integer NOT NULL,
	"planned_start" date,
	"planned_end" date,
	"actual_start" date,
	"actual_end" date,
	"status" "stage_status" DEFAULT 'not_started' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	CONSTRAINT "task_dependencies_task_id_depends_on_task_id_pk" PRIMARY KEY("task_id","depends_on_task_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"stage_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"due_date" date,
	"assigned_contact_id" uuid,
	"is_compliance_item" boolean DEFAULT false NOT NULL,
	"source_template_item_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"budget_category_id" uuid,
	"contact_id" uuid,
	"description" text NOT NULL,
	"transaction_date" date NOT NULL,
	"amount_ex_gst" bigint DEFAULT 0 NOT NULL,
	"gst_amount" bigint DEFAULT 0 NOT NULL,
	"gst_applicable" boolean DEFAULT true NOT NULL,
	"type" "transaction_type" DEFAULT 'invoice' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"document_id" uuid
);
--> statement-breakpoint
CREATE TABLE "variations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"project_id" uuid NOT NULL,
	"budget_category_id" uuid,
	"description" text NOT NULL,
	"reason" text,
	"amount_ex_gst" bigint DEFAULT 0 NOT NULL,
	"gst_amount" bigint DEFAULT 0 NOT NULL,
	"gst_applicable" boolean DEFAULT true NOT NULL,
	"status" "variation_status" DEFAULT 'proposed' NOT NULL,
	"variation_date" date
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"url" text NOT NULL,
	"event_types" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"event_type" "webhook_event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"delivered_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_checklist_template_id_checklist_templates_id_fk" FOREIGN KEY ("checklist_template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_insurances" ADD CONSTRAINT "contact_insurances_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selections" ADD CONSTRAINT "selections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_budget_category_id_budget_categories_id_fk" FOREIGN KEY ("budget_category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_budget_category_id_budget_categories_id_fk" FOREIGN KEY ("budget_category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_account_idx" ON "audit_log" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "audit_record_idx" ON "audit_log" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "budget_categories_project_idx" ON "budget_categories" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "contacts_account_idx" ON "contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "diary_project_idx" ON "diary_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "documents_project_idx" ON "documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "inspections_project_idx" ON "inspections" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "photos_project_idx" ON "photos" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_account_idx" ON "projects" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "quotes_project_idx" ON "quotes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "stages_project_idx" ON "stages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_stage_idx" ON "tasks" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "transactions_project_idx" ON "transactions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "variations_project_idx" ON "variations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "webhook_events_account_idx" ON "webhook_events" USING btree ("account_id");