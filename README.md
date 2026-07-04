# Owner-Builder Project Management (Australia)

Web-based project management for Australian owner-builders: build stages and tasks,
GST-aware budget control, contacts/quotes with licence + insurance tracking, a
document vault, and an immutable site diary — with VIC compliance content seeded
as data. Installable PWA, built mobile-first for use on-site.

> **Not legal advice.** Compliance content is a checklist aid only. Verify every
> requirement with the [VBA](https://www.vba.vic.gov.au) and your relevant
> building surveyor.

## Status: Phase 1 complete

| Phase | Scope | Status |
| --- | --- | --- |
| 1 — Core | Auth, project wizard, stages/tasks (kanban + list), budget (categories/transactions/variations, GST), contacts & quotes (3-way comparison), documents, site diary + photo timeline, dashboard, export, API keys, webhooks | ✅ built |
| 2 — Compliance & Risk | Compliance view, inspection gating, alerts engine, defects/selections, handover pack | ⏳ next |
| 3 — AI | Quote ingestion, receipt capture, risk flags, ask-the-build (via OpenRouter registry — registry + settings UI already shipped) | ⏳ later |
| 4 — Future | Native apps, SaaS billing, Xero, portals | 🚫 out of scope |

## Quick start (zero external services)

```bash
cd owner-builder
pnpm install
cp .env.example .env.local        # then set: DB_DRIVER=pglite and AUTH_MODE=dev
pnpm db:seed                      # seeds VIC content + dev account
pnpm dev                          # http://localhost:3000
```

`DB_DRIVER=pglite` runs an embedded in-process Postgres (data in `.pglite/`) and
`AUTH_MODE=dev` signs you in as the seeded dev owner — for local development only.
Files upload to `.storage/` and are served through the authenticated files route.

## Production setup (Supabase)

1. Create a Supabase project (managed) — or self-host; `docker-compose.yml` here
   runs Postgres + nightly backups, and the full self-hosted Supabase path is
   [documented by Supabase](https://supabase.com/docs/guides/self-hosting/docker).
2. Set in `.env.local` / deployment env:
   `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SIGNING_SECRET`, `CRON_SECRET`.
3. `pnpm db:migrate && pnpm db:seed`
4. Create a Storage bucket named `project-files` (private).
5. Enable Email and Google providers in Supabase Auth.
6. Point a cron (Vercel cron or container crontab) at
   `POST /api/v1/jobs/run` with `Authorization: Bearer $CRON_SECRET` (e.g. every 15 min).
7. After a user signs up, add them to an account:
   `insert into accounts…; insert into account_members…` (single-tenant onboarding
   is manual until Phase 4 SaaS onboarding).

## Architecture

- **API-first** — all business logic behind `/api/v1/...` route handlers that
  delegate to `/src/lib/services`. The Next.js UI is just the first client;
  future mobile apps consume the same API. OpenAPI 3.1 spec generated from the
  Zod validation schemas: `GET /api/v1/openapi.json` or `pnpm openapi`.
- **Multi-tenant from day one** — every domain table carries `account_id`;
  Postgres RLS enabled with tenant-isolation policies (migration `0001_rls`),
  and the service layer scopes every query by account.
- **State as data** — build stages, budget categories and compliance checklists
  are seeded database content keyed by state (`stage_templates`,
  `checklist_templates`); VIC ships first. No regulatory logic in code.
- **Money** — integer cents everywhere, `amount_ex_gst` + `gst_amount` +
  `gst_applicable` on every money row; GST = 10% (ex→inc) or 1/11 (inc→ex),
  rounded half-up per record.
- **Auditability** — `audit_log` rows for transactions, variations, inspections,
  documents; diary entries are immutable (edits create superseding revisions).
- **Auth** — Supabase Auth (email/password + Google; native SDKs keep the mobile
  door open) + hashed, scoped, revocable API keys (`ob_...`) for machine access
  (n8n).
- **Webhooks** — HMAC-signed events (`task.due`, `inspection.due`,
  `insurance.expiring`, `budget.threshold`, `document.added`) delivered by the
  jobs route so n8n handles email/SMS/Slack.
- **AI-ready, not AI-yet** — `ai_task_configs` maps each AI task type to an
  OpenRouter model (editable in Settings; vision-required tasks reject
  non-vision models); `ai_usage_log` powers the spend view. The OpenRouter call
  path lands in Phase 3.
- **PWA** — manifest + service worker (shell caching, offline navigation
  fallback); photos are resized client-side before upload; camera capture via
  `capture="environment"`.

## Commands

```bash
pnpm dev / build / start   # Next.js
pnpm test                  # vitest: money/GST, budget maths, service layer (embedded PG), API contract
pnpm typecheck             # tsc
pnpm db:generate           # drizzle-kit: new migration from schema change
pnpm db:migrate            # apply committed migrations to DATABASE_URL
pnpm db:seed               # seed jurisdiction content (+ dev account)
pnpm openapi               # write openapi.json
```

## Decisions & notes (Phase 1)

- **All Section-4 domain tables** are created in the initial migration (including
  Phase-2 `defects`/`selections` and Phase-3 AI tables) to avoid migration churn,
  but only Phase-1 features have API/UI. No Phase-3 behaviour was scaffolded.
- **Committed budget** = accepted quotes + approved variations per category;
  contingency burn counts approved cost *increases* only (savings don't refill it).
- **`budget.threshold` webhook** fires when a category crosses 90% consumed on
  transaction entry; full alerts engine (in-app) is Phase 2.
- **Inspections**: VIC mandatory notification stages are instantiated per project
  and shown on the dashboard. Stage-completion gating (block "complete" without a
  passed inspection) is Phase 2 scope.
- **PGlite dev mode** exists so the app and tests run with zero infrastructure;
  production uses real Postgres via `DATABASE_URL` (`prepare: false` for
  PgBouncer/Supavisor compatibility).
- **VIC checklist content** carries `source_url` per item and a `last_verified_at`
  field that is deliberately **null** until each item/threshold is verified against
  current VBA / Consumer Affairs Victoria guidance — do that before relying on the
  numbers (e.g. the historical $16,000 / $10,000 thresholds).
- **RLS**: policies key on an `app.account_id` connection setting; the API's
  service-role connection bypasses RLS by design and the service layer enforces
  account scoping on every query. When direct client connections arrive (mobile,
  Phase 4), add Supabase `auth.uid()`-based policies alongside.
