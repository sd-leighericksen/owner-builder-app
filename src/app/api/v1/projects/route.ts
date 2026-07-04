import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { projectCreate } from "@/lib/validation/schemas";
import { listProjects, createProject } from "@/lib/services/projects";

export const GET = apiHandler(async ({ auth }) => {
  return json({ items: await listProjects(auth.accountId) });
});

export const POST = apiHandler(async ({ request, auth }) => {
  const input = await parseBody(request, projectCreate);
  const project = await createProject(auth.accountId, auth.userId, input);
  return json(project, { status: 201 });
});
