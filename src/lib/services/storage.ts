import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * File storage abstraction. Production: Supabase Storage buckets with signed
 * URLs (brief §3). Local dev without Supabase: files on disk under .storage/,
 * served through the authenticated /api/v1/files route. Callers never build
 * URLs themselves — they store the storagePath and request a signed URL.
 */

const BUCKET = "project-files";
const LOCAL_ROOT = path.join(process.cwd(), ".storage");

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function putFile(storagePath: string, data: Buffer, contentType: string): Promise<void> {
  const supabase = supabaseAdmin();
  if (supabase) {
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, data, {
      contentType,
      upsert: false,
    });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return;
  }
  const full = path.join(LOCAL_ROOT, storagePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

/** Signed, time-limited URL for reading a file (brief §7.6). */
export async function getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = supabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
    return data.signedUrl;
  }
  // Local fallback: served by the authenticated files route.
  return `/api/v1/files/${encodeURIComponent(storagePath)}`;
}

export async function readLocalFile(storagePath: string): Promise<Buffer> {
  const full = path.resolve(LOCAL_ROOT, storagePath);
  if (!full.startsWith(path.resolve(LOCAL_ROOT) + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return fs.readFile(full);
}
