-- Row Level Security on every tenant-scoped table (brief §4, §7.6).
-- Policies key on the app.account_id setting, which the service layer sets for
-- its connection. On Supabase, direct client access is not used (all access
-- goes through the API), so these policies are defence-in-depth: any future
-- direct-connection client only sees rows for the account it declares, and
-- declares it via a setting only the server can issue.
--
-- The service-role/owner connection used by the API bypasses RLS by design;
-- the service layer additionally scopes EVERY query by account_id.

CREATE OR REPLACE FUNCTION app_current_account_id() RETURNS uuid
LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('app.account_id', true), '')::uuid
$fn$;
--> statement-breakpoint
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'api_keys','projects','stages','tasks','contacts','contact_insurances',
    'quotes','quote_line_items','budget_categories','transactions','variations',
    'documents','inspections','diary_entries','photos','defects','selections',
    'ai_task_configs','ai_usage_log','webhook_endpoints','webhook_events',
    'notifications','audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (account_id = app_current_account_id()) WITH CHECK (account_id = app_current_account_id())',
      t || '_tenant_isolation', t
    );
  END LOOP;
END
$do$;
--> statement-breakpoint
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY accounts_tenant_isolation ON accounts
  USING (id = app_current_account_id());
--> statement-breakpoint
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY account_members_tenant_isolation ON account_members
  USING (account_id = app_current_account_id());
