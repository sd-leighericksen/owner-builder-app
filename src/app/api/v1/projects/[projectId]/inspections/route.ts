import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { inspectionCreate } from "@/lib/validation/schemas";
import { listInspections, createInspection } from "@/lib/services/inspections";

type P = { projectId: string };

export const GET = apiHandler<P>(async ({ auth, params }) => {
  return json({ items: await listInspections(auth.accountId, params.projectId) });
});

export const POST = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, inspectionCreate.omit({ projectId: true }));
  const inspection = await createInspection(auth.accountId, auth.userId, { ...input, projectId: params.projectId });
  return json(inspection, { status: 201 });
});
