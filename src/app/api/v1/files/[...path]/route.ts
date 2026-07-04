import { apiHandler } from "@/lib/api/handler";
import { ForbiddenError, NotFoundError } from "@/lib/api/handler";
import { readLocalFile } from "@/lib/services/storage";

/**
 * Serves files from local-disk storage (dev fallback when Supabase Storage is
 * not configured). Authenticated, and only paths under the caller's account
 * prefix are readable.
 */
export const GET = apiHandler<{ path: string[] }>(async ({ auth, params }) => {
  const storagePath = params.path.map(decodeURIComponent).join("/");
  if (!storagePath.startsWith(`${auth.accountId}/`)) {
    throw new ForbiddenError("File belongs to another account");
  }
  try {
    const data = await readLocalFile(storagePath);
    return new Response(new Uint8Array(data), {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    throw new NotFoundError("File not found");
  }
});
