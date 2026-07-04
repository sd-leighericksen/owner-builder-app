import { and, asc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { aiTaskConfigs, aiUsageLog } from "@/db/schema";
import { NotFoundError, ConflictError } from "@/lib/api/handler";
import { seedAiTaskConfigs } from "@/db/seed";
import type { aiTaskConfigUpdate } from "@/lib/validation/schemas";

/**
 * AI task → model registry (brief §3). Phase 1 ships the registry and settings
 * screen only; the OpenRouter call path arrives in Phase 3. All AI config is
 * data: models are swappable without code changes.
 *
 * Vision capability is data too: a task type flagged requires_vision may only
 * be assigned models known to support image input.
 */

// Prefix allowlist for vision-capable OpenRouter models. Editable here until a
// live model-capability lookup lands with Phase 3.
const VISION_MODEL_PREFIXES = [
  "openai/gpt-4o",
  "openai/gpt-4.1",
  "openai/gpt-5",
  "google/gemini-",
  "anthropic/claude-",
  "meta-llama/llama-3.2-90b-vision",
  "meta-llama/llama-4",
  "qwen/qwen2.5-vl",
  "mistralai/pixtral",
];

export function isVisionCapable(modelId: string): boolean {
  return VISION_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}

export async function listAiTaskConfigs(accountId: string) {
  const db = await getDb();
  await seedAiTaskConfigs(accountId); // self-heal: every task type has a row
  return db
    .select()
    .from(aiTaskConfigs)
    .where(and(eq(aiTaskConfigs.accountId, accountId), isNull(aiTaskConfigs.deletedAt)))
    .orderBy(asc(aiTaskConfigs.taskType));
}

export async function updateAiTaskConfig(
  accountId: string,
  taskType: string,
  input: z.infer<typeof aiTaskConfigUpdate>,
) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiTaskConfigs)
    .where(
      and(
        eq(aiTaskConfigs.accountId, accountId),
        eq(aiTaskConfigs.taskType, taskType as never),
        isNull(aiTaskConfigs.deletedAt),
      ),
    );
  const existing = rows[0];
  if (!existing) throw new NotFoundError("AI task config not found");

  // Guard: never assign a non-vision model to a vision task (brief §4).
  if (existing.requiresVision) {
    const modelId = input.modelId ?? existing.modelId;
    if (!isVisionCapable(modelId)) {
      throw new ConflictError(
        `Task type "${taskType}" requires a vision-capable model; "${modelId}" is not recognised as one`,
      );
    }
    if (input.fallbackModelId && !isVisionCapable(input.fallbackModelId)) {
      throw new ConflictError(
        `Fallback model "${input.fallbackModelId}" is not vision-capable but "${taskType}" requires vision`,
      );
    }
  }

  await db
    .update(aiTaskConfigs)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(aiTaskConfigs.id, existing.id));
  return (await db.select().from(aiTaskConfigs).where(eq(aiTaskConfigs.id, existing.id)))[0];
}

/** Simple AI spend view for settings (brief §4 ai_usage_log). */
export async function getAiUsageSummary(accountId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiUsageLog)
    .where(eq(aiUsageLog.accountId, accountId));
  const byTask = new Map<string, { calls: number; promptTokens: number; completionTokens: number; costMicros: number; errors: number }>();
  for (const row of rows) {
    const entry = byTask.get(row.taskType) ?? { calls: 0, promptTokens: 0, completionTokens: 0, costMicros: 0, errors: 0 };
    entry.calls++;
    entry.promptTokens += row.promptTokens ?? 0;
    entry.completionTokens += row.completionTokens ?? 0;
    entry.costMicros += row.reportedCostMicros ?? 0;
    if (row.outcome === "error") entry.errors++;
    byTask.set(row.taskType, entry);
  }
  return Object.fromEntries(byTask);
}
