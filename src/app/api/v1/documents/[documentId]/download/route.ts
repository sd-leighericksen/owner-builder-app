import { apiHandler, json } from "@/lib/api/handler";
import { getDocumentDownloadUrl } from "@/lib/services/documents";

/** Returns a signed, time-limited URL — never a public link (brief §7.6). */
export const GET = apiHandler<{ documentId: string }>(async ({ auth, params }) => {
  const url = await getDocumentDownloadUrl(auth.accountId, params.documentId);
  return json({ url });
});
