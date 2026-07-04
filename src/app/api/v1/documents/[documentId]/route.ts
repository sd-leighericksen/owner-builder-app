import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { documentUpdate } from "@/lib/validation/schemas";
import { getDocument, updateDocument, softDeleteDocument } from "@/lib/services/documents";

type P = { documentId: string };

export const GET = apiHandler<P>(async ({ auth, params }) => {
  return json(await getDocument(auth.accountId, params.documentId));
});

export const PATCH = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, documentUpdate);
  return json(await updateDocument(auth.accountId, auth.userId, params.documentId, input));
});

export const DELETE = apiHandler<P>(async ({ auth, params }) => {
  await softDeleteDocument(auth.accountId, auth.userId, params.documentId);
  return json({ ok: true });
});
