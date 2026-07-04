"use client";

/**
 * Thin client for the versioned REST API. The web UI is just the first API
 * client (brief §2.1) — no business logic lives here.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: unknown[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let code = "error";
  let message = res.statusText;
  let issues: unknown[] | undefined;
  try {
    const body = await res.json();
    code = body?.error?.code ?? code;
    message = body?.error?.message ?? message;
    issues = body?.error?.issues;
  } catch {
    // non-JSON error body
  }
  throw new ApiError(res.status, code, message, issues);
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(path, { headers: { Accept: "application/json" } }).then((r) => handle<T>(r));
}

export function apiSend<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  return fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => handle<T>(r));
}

export function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return fetch(path, { method: "POST", body: form }).then((r) => handle<T>(r));
}
