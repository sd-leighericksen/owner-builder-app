import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { taskCreate } from "@/lib/validation/schemas";
import { listTasks, createTask } from "@/lib/services/tasks";

type P = { projectId: string };

export const GET = apiHandler<P>(async ({ request, auth, params }) => {
  const url = new URL(request.url);
  const items = await listTasks(auth.accountId, params.projectId, {
    stageId: url.searchParams.get("stageId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    assignedContactId: url.searchParams.get("assignedContactId") ?? undefined,
  });
  return json({ items });
});

export const POST = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, taskCreate.omit({ projectId: true }));
  const task = await createTask(auth.accountId, auth.userId, { ...input, projectId: params.projectId });
  return json(task, { status: 201 });
});
