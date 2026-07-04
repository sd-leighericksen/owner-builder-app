import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { diaryEntryRevise } from "@/lib/validation/schemas";
import { reviseDiaryEntry } from "@/lib/services/diary";

/** Diary entries are immutable — this creates a superseding revision (§7.2). */
export const POST = apiHandler<{ entryId: string }>(async ({ request, auth, params }) => {
  const input = await parseBody(request, diaryEntryRevise);
  return json(await reviseDiaryEntry(auth.accountId, auth.userId, params.entryId, input), { status: 201 });
});
