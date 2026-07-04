import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { documentCreate } from "@/lib/validation/schemas";
import { listDocuments, createDocument } from "@/lib/services/documents";

export const GET = apiHandler(async ({ request, auth }) => {
  const url = new URL(request.url);
  const items = await listDocuments(auth.accountId, {
    projectId: url.searchParams.get("projectId") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    stageId: url.searchParams.get("stageId") ?? undefined,
    taskId: url.searchParams.get("taskId") ?? undefined,
    contactId: url.searchParams.get("contactId") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });
  return json({ items });
});

/**
 * Create a document. Accepts either JSON (metadata only) or multipart/form-data
 * with a `file` part plus a `meta` JSON part.
 */
export const POST = apiHandler(async ({ request, auth }) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const metaRaw = form.get("meta");
    const meta = documentCreate.parse(JSON.parse(typeof metaRaw === "string" ? metaRaw : "{}"));
    const filePart = form.get("file");
    let file = null;
    if (filePart instanceof File) {
      file = {
        name: filePart.name,
        type: filePart.type,
        data: Buffer.from(await filePart.arrayBuffer()),
      };
    }
    const doc = await createDocument(auth.accountId, auth.userId, meta, file);
    return json(doc, { status: 201 });
  }
  const meta = await parseBody(request, documentCreate);
  const doc = await createDocument(auth.accountId, auth.userId, meta, null);
  return json(doc, { status: 201 });
});
