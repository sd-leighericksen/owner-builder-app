import { and, asc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import {
  projects,
  stages,
  tasks,
  inspections,
  budgetCategories,
  stageTemplates,
  checklistTemplates,
  checklistTemplateItems,
} from "@/db/schema";
import { newId } from "@/lib/ids";
import { NotFoundError } from "@/lib/api/handler";
import type { projectCreate, projectUpdate } from "@/lib/validation/schemas";
import { AU_RESIDENTIAL_BUDGET_CATEGORIES } from "@/db/seed-data/vic";

type ProjectCreateInput = z.infer<typeof projectCreate>;
type ProjectUpdateInput = z.infer<typeof projectUpdate>;

export async function listProjects(accountId: string) {
  const db = await getDb();
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.accountId, accountId), isNull(projects.deletedAt)))
    .orderBy(asc(projects.createdAt));
}

export async function getProject(accountId: string, projectId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.accountId, accountId), isNull(projects.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Project not found");
  return rows[0];
}

/**
 * Project creation wizard (brief §5 Phase 1.1). Seeds, per the project's state:
 * - build stages from stage_templates
 * - budget categories from the Australian residential structure
 * - compliance checklist items instantiated into tasks and inspections
 * All jurisdiction content comes from the database, never hard-coded rules.
 */
export async function createProject(accountId: string, userId: string, input: ProjectCreateInput) {
  const db = await getDb();
  const projectId = newId();

  await db.insert(projects).values({
    id: projectId,
    accountId,
    createdBy: userId,
    name: input.name,
    address: input.address,
    lotPlanDetails: input.lotPlanDetails,
    state: input.state,
    ownerBuilderPermitNo: input.ownerBuilderPermitNo,
    buildingPermitNo: input.buildingPermitNo,
    startDate: input.startDate,
    targetCompletionDate: input.targetCompletionDate,
    totalBudget: input.totalBudget,
    contingencyAmount: input.contingencyAmount,
  });

  const stageIdByName = new Map<string, string>();

  if (input.seedStages) {
    const templates = await db
      .select()
      .from(stageTemplates)
      .where(eq(stageTemplates.state, input.state))
      .orderBy(asc(stageTemplates.sequence));
    if (templates.length > 0) {
      const rows = templates.map((t) => {
        const id = newId();
        stageIdByName.set(t.name, id);
        return { id, accountId, createdBy: userId, projectId, name: t.name, sequence: t.sequence };
      });
      await db.insert(stages).values(rows);
    }
  }

  if (input.seedBudgetCategories) {
    await db.insert(budgetCategories).values(
      AU_RESIDENTIAL_BUDGET_CATEGORIES.map((c, i) => ({
        id: newId(),
        accountId,
        createdBy: userId,
        projectId,
        code: c.code,
        name: c.name,
        isContingency: c.isContingency ?? false,
        budgetAmount: c.isContingency ? input.contingencyAmount : 0,
        sortOrder: i,
      })),
    );
  }

  if (input.seedChecklist) {
    const templates = await db
      .select()
      .from(checklistTemplates)
      .where(eq(checklistTemplates.state, input.state));
    for (const template of templates) {
      const items = await db
        .select()
        .from(checklistTemplateItems)
        .where(eq(checklistTemplateItems.checklistTemplateId, template.id))
        .orderBy(asc(checklistTemplateItems.sortOrder));
      const taskRows = [];
      const inspectionRows = [];
      for (const item of items) {
        const stageId = item.appliesToStage ? (stageIdByName.get(item.appliesToStage) ?? null) : null;
        if (item.itemKind === "inspection") {
          inspectionRows.push({
            id: newId(),
            accountId,
            createdBy: userId,
            projectId,
            stageId,
            type: item.title,
            required: item.required,
            notes: item.description,
            sourceTemplateItemId: item.id,
          });
        } else {
          taskRows.push({
            id: newId(),
            accountId,
            createdBy: userId,
            projectId,
            stageId,
            title: item.title,
            description: [item.description, item.helpUrl ? `More info: ${item.helpUrl}` : null]
              .filter(Boolean)
              .join("\n\n"),
            isComplianceItem: true,
            sourceTemplateItemId: item.id,
          });
        }
      }
      if (taskRows.length > 0) await db.insert(tasks).values(taskRows);
      if (inspectionRows.length > 0) await db.insert(inspections).values(inspectionRows);
    }
  }

  return getProject(accountId, projectId);
}

export async function updateProject(accountId: string, projectId: string, input: ProjectUpdateInput) {
  const db = await getDb();
  await getProject(accountId, projectId); // 404 if missing
  await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.accountId, accountId)));
  return getProject(accountId, projectId);
}

export async function softDeleteProject(accountId: string, projectId: string) {
  const db = await getDb();
  await getProject(accountId, projectId);
  await db
    .update(projects)
    .set({ deletedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.accountId, accountId)));
}

export async function listStages(accountId: string, projectId: string) {
  const db = await getDb();
  return db
    .select()
    .from(stages)
    .where(and(eq(stages.projectId, projectId), eq(stages.accountId, accountId), isNull(stages.deletedAt)))
    .orderBy(asc(stages.sequence));
}

export async function updateStage(
  accountId: string,
  stageId: string,
  input: Record<string, unknown>,
) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.accountId, accountId), isNull(stages.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Stage not found");
  await db
    .update(stages)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(stages.id, stageId));
  const updated = await db.select().from(stages).where(eq(stages.id, stageId));
  return updated[0];
}
