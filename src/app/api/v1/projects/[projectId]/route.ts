import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { projectUpdate } from "@/lib/validation/schemas";
import { getProject, updateProject, softDeleteProject } from "@/lib/services/projects";

type P = { projectId: string };

export const GET = apiHandler<P>(async ({ auth, params }) => {
  return json(await getProject(auth.accountId, params.projectId));
});

export const PATCH = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, projectUpdate);
  return json(await updateProject(auth.accountId, params.projectId, input));
});

export const DELETE = apiHandler<P>(async ({ auth, params }) => {
  await softDeleteProject(auth.accountId, params.projectId);
  return json({ ok: true });
});
