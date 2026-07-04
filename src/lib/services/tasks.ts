import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { tasks, taskDependencies } from "@/db/schema";
import { newId } from "@/lib/ids";
import { NotFoundError } from "@/lib/api/handler";
import type { taskCreate, taskUpdate } from "@/lib/validation/schemas";

type TaskCreateInput = z.infer<typeof taskCreate>;
type TaskUpdateInput = z.infer<typeof taskUpdate>;

export interface TaskWithDeps {
  id: string;
  projectId: string;
  stageId: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  dueDate: string | null;
  assignedContactId: string | null;
  isComplianceItem: boolean;
  sortOrder: number;
  dependsOnTaskIds: string[];
  /** Titles of unfinished dependencies — the list view's dependency warning. */
  blockedByOpenDependencies: string[];
}

export async function listTasks(
  accountId: string,
  projectId: string,
  filters: { stageId?: string; status?: string; assignedContactId?: string } = {},
): Promise<TaskWithDeps[]> {
  const db = await getDb();
  const conditions = [
    eq(tasks.projectId, projectId),
    eq(tasks.accountId, accountId),
    isNull(tasks.deletedAt),
  ];
  if (filters.stageId) conditions.push(eq(tasks.stageId, filters.stageId));
  if (filters.status) conditions.push(eq(tasks.status, filters.status as TaskWithDeps["status"]));
  if (filters.assignedContactId) conditions.push(eq(tasks.assignedContactId, filters.assignedContactId));

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.sortOrder), asc(tasks.id));

  if (rows.length === 0) return [];

  const deps = await db
    .select()
    .from(taskDependencies)
    .where(inArray(taskDependencies.taskId, rows.map((r) => r.id)));

  // Resolve dependency task states for warnings (may point outside the filter).
  const depIds = [...new Set(deps.map((d) => d.dependsOnTaskId))];
  const depTasks = depIds.length
    ? await db.select().from(tasks).where(inArray(tasks.id, depIds))
    : [];
  const depTaskById = new Map(depTasks.map((t) => [t.id, t]));

  return rows.map((row) => {
    const dependsOn = deps.filter((d) => d.taskId === row.id).map((d) => d.dependsOnTaskId);
    const blockedBy = dependsOn
      .map((id) => depTaskById.get(id))
      .filter((t) => t && t.status !== "done" && !t.deletedAt)
      .map((t) => t!.title);
    return {
      id: row.id,
      projectId: row.projectId,
      stageId: row.stageId,
      title: row.title,
      description: row.description,
      status: row.status,
      dueDate: row.dueDate,
      assignedContactId: row.assignedContactId,
      isComplianceItem: row.isComplianceItem,
      sortOrder: row.sortOrder,
      dependsOnTaskIds: dependsOn,
      blockedByOpenDependencies: blockedBy,
    };
  });
}

export async function getTask(accountId: string, taskId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.accountId, accountId), isNull(tasks.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Task not found");
  return rows[0];
}

export async function createTask(accountId: string, userId: string, input: TaskCreateInput) {
  const db = await getDb();
  const id = newId();
  const { dependsOnTaskIds, ...fields } = input;
  await db.insert(tasks).values({ id, accountId, createdBy: userId, ...fields });
  if (dependsOnTaskIds.length > 0) {
    await db
      .insert(taskDependencies)
      .values(dependsOnTaskIds.map((depId) => ({ taskId: id, dependsOnTaskId: depId })));
  }
  return getTask(accountId, id);
}

export async function updateTask(accountId: string, taskId: string, input: TaskUpdateInput) {
  const db = await getDb();
  await getTask(accountId, taskId);
  const { dependsOnTaskIds, ...fields } = input;
  if (Object.keys(fields).length > 0) {
    await db
      .update(tasks)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.accountId, accountId)));
  }
  if (dependsOnTaskIds !== undefined) {
    await db.delete(taskDependencies).where(eq(taskDependencies.taskId, taskId));
    if (dependsOnTaskIds.length > 0) {
      await db
        .insert(taskDependencies)
        .values(dependsOnTaskIds.map((depId) => ({ taskId, dependsOnTaskId: depId })));
    }
  }
  return getTask(accountId, taskId);
}

export async function softDeleteTask(accountId: string, taskId: string) {
  const db = await getDb();
  await getTask(accountId, taskId);
  await db
    .update(tasks)
    .set({ deletedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.accountId, accountId)));
}
