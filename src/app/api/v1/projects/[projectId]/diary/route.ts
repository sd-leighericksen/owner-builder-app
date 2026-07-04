import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { diaryEntryCreate } from "@/lib/validation/schemas";
import { listDiaryEntries, createDiaryEntry } from "@/lib/services/diary";

type P = { projectId: string };

export const GET = apiHandler<P>(async ({ request, auth, params }) => {
  const url = new URL(request.url);
  const includeSuperseded = url.searchParams.get("includeSuperseded") === "true";
  return json({ items: await listDiaryEntries(auth.accountId, params.projectId, includeSuperseded) });
});

export const POST = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, diaryEntryCreate.omit({ projectId: true }));
  const entry = await createDiaryEntry(auth.accountId, auth.userId, { ...input, projectId: params.projectId });
  return json(entry, { status: 201 });
});
