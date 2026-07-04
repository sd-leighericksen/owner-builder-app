import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { inspectionUpdate } from "@/lib/validation/schemas";
import { updateInspection } from "@/lib/services/inspections";

export const PATCH = apiHandler<{ inspectionId: string }>(async ({ request, auth, params }) => {
  const input = await parseBody(request, inspectionUpdate);
  return json(await updateInspection(auth.accountId, auth.userId, params.inspectionId, input));
});
