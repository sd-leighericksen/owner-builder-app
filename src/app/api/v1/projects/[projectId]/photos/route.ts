import { apiHandler, json } from "@/lib/api/handler";
import { listPhotos, createPhoto } from "@/lib/services/diary";
import { ZodError } from "zod";

type P = { projectId: string };

export const GET = apiHandler<P>(async ({ request, auth, params }) => {
  const url = new URL(request.url);
  const stageId = url.searchParams.get("stageId") ?? undefined;
  return json({ items: await listPhotos(auth.accountId, params.projectId, stageId) });
});

/**
 * Multipart photo upload. Parts: `file` (required), `thumbnail` (optional,
 * client-side resized — brief §7.5), `caption`, `stageId`, `takenAt`,
 * `diaryEntryId`.
 */
export const POST = apiHandler<P>(async ({ request, auth, params }) => {
  const form = await request.formData();
  const filePart = form.get("file");
  if (!(filePart instanceof File)) {
    throw new ZodError([{ code: "custom", message: "file part is required", path: ["file"] }]);
  }
  const thumbPart = form.get("thumbnail");
  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const photo = await createPhoto(
    auth.accountId,
    auth.userId,
    {
      projectId: params.projectId,
      stageId: str("stageId"),
      caption: str("caption"),
      takenAt: str("takenAt"),
      diaryEntryId: str("diaryEntryId"),
    },
    { name: filePart.name, type: filePart.type, data: Buffer.from(await filePart.arrayBuffer()) },
    thumbPart instanceof File
      ? { type: thumbPart.type, data: Buffer.from(await thumbPart.arrayBuffer()) }
      : null,
  );
  return json(photo, { status: 201 });
});
