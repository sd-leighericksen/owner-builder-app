import { apiHandler, json } from "@/lib/api/handler";
import { exportProject } from "@/lib/services/export";

/** Full project export as JSON — the user's data is never trapped (§7.3). */
export const GET = apiHandler<{ projectId: string }>(async ({ auth, params }) => {
  const data = await exportProject(auth.accountId, params.projectId);
  return json(data, {
    headers: {
      "Content-Disposition": `attachment; filename="project-export-${params.projectId}.json"`,
    },
  });
});
