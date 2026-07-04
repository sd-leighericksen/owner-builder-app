import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { taskUpdate } from "@/lib/validation/schemas";
import { getTask, updateTask, softDeleteTask } from "@/lib/services/tasks";

type P = { taskId: string };

export const GET = apiHandler<P>(async ({ auth, params }) => {
  return json(await getTask(auth.accountId, params.taskId));
});

export const PATCH = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, taskUpdate);
  return json(await updateTask(auth.accountId, params.taskId, input));
});

export const DELETE = apiHandler<P>(async ({ auth, params }) => {
  await softDeleteTask(auth.accountId, params.taskId);
  return json({ ok: true });
});
