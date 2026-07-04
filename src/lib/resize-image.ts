"use client";

/**
 * Client-side photo resize before upload (brief §7.5 — usable on 4G on-site).
 * Returns a resized "original" (capped at maxDim) plus a small thumbnail.
 */
export async function resizeImage(
  file: File,
  maxDim = 2048,
  thumbDim = 400,
): Promise<{ original: Blob; thumbnail: Blob }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // Unsupported format (e.g. HEIC in some browsers) — upload as-is, no thumb.
    return { original: file, thumbnail: file };
  }
  const original = await drawScaled(bitmap, maxDim, file.type);
  const thumbnail = await drawScaled(bitmap, thumbDim, "image/jpeg");
  bitmap.close();
  return { original, thumbnail };
}

async function drawScaled(bitmap: ImageBitmap, maxDim: number, preferredType: string): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const type = preferredType.startsWith("image/") ? "image/jpeg" : "image/jpeg";
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image encode failed"))), type, 0.85);
  });
}
