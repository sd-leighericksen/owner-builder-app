// Seeds jurisdiction content (VIC) and, when AUTH_MODE=dev, a dev account.
// Idempotent — safe to run repeatedly. Usage: pnpm db:seed
import { eq, and } from "drizzle-orm";
import { getDb } from "./index";
import {
  stageTemplates,
  checklistTemplates,
  checklistTemplateItems,
  accounts,
  accountMembers,
  aiTaskConfigs,
} from "./schema";
import { VIC_STAGE_TEMPLATE, VIC_CHECKLIST, DEFAULT_AI_TASK_CONFIGS } from "./seed-data/vic";
import { newId } from "../lib/ids";

export const DEV_ACCOUNT_ID = "00000000-0000-7000-8000-000000000001";
export const DEV_USER_ID = "00000000-0000-7000-8000-0000000000aa";

export async function seedJurisdictionContent() {
  const db = await getDb();

  const existingStages = await db.select().from(stageTemplates).where(eq(stageTemplates.state, "VIC"));
  if (existingStages.length === 0) {
    await db.insert(stageTemplates).values(
      VIC_STAGE_TEMPLATE.map((name, i) => ({ id: newId(), state: "VIC" as const, name, sequence: i + 1 })),
    );
  }

  const existingChecklist = await db
    .select()
    .from(checklistTemplates)
    .where(and(eq(checklistTemplates.state, "VIC"), eq(checklistTemplates.name, VIC_CHECKLIST.name)));
  if (existingChecklist.length === 0) {
    const templateId = newId();
    await db.insert(checklistTemplates).values({
      id: templateId,
      state: "VIC",
      name: VIC_CHECKLIST.name,
      description: VIC_CHECKLIST.description,
    });
    await db.insert(checklistTemplateItems).values(
      VIC_CHECKLIST.items.map((item, i) => ({
        id: newId(),
        checklistTemplateId: templateId,
        appliesToStage: item.appliesToStage,
        title: item.title,
        description: item.description,
        helpUrl: item.helpUrl,
        sourceUrl: item.sourceUrl,
        required: item.required,
        itemKind: item.itemKind,
        lastVerifiedAt: item.lastVerifiedAt,
        sortOrder: i,
      })),
    );
  }
}

export async function seedDevAccount() {
  const db = await getDb();

  const existing = await db.select().from(accounts).where(eq(accounts.id, DEV_ACCOUNT_ID));
  if (existing.length === 0) {
    await db.insert(accounts).values({ id: DEV_ACCOUNT_ID, name: "My Build" });
    await db.insert(accountMembers).values({
      accountId: DEV_ACCOUNT_ID,
      userId: DEV_USER_ID,
      role: "owner",
      displayName: "Owner (dev)",
      email: "owner@example.com",
    });
  }
  await seedAiTaskConfigs(DEV_ACCOUNT_ID);
}

/** Ensure every AI task type has a config row for the account (brief §4). */
export async function seedAiTaskConfigs(accountId: string) {
  const db = await getDb();
  const existing = await db.select().from(aiTaskConfigs).where(eq(aiTaskConfigs.accountId, accountId));
  const have = new Set(existing.map((c) => c.taskType));
  const missing = DEFAULT_AI_TASK_CONFIGS.filter((c) => !have.has(c.taskType));
  if (missing.length > 0) {
    await db.insert(aiTaskConfigs).values(missing.map((c) => ({ id: newId(), accountId, ...c })));
  }
}

async function main() {
  await seedJurisdictionContent();
  await seedDevAccount();
  console.log("Seed complete.");
}

// Run directly (tsx src/db/seed.ts) but not when imported.
if (process.argv[1]?.endsWith("seed.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
