import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { getAuthContext, UnauthorisedError, type AuthContext } from "@/lib/auth";

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

type RouteContext<P> = { params: Promise<P> };

interface HandlerArgs<P> {
  request: Request;
  auth: AuthContext;
  params: P;
}

/**
 * Wraps an /api/v1 route handler with auth resolution and consistent error
 * mapping. All business logic stays in /lib/services — handlers only parse,
 * authorise, delegate, serialise.
 */
export function apiHandler<P = Record<string, never>>(
  fn: (args: HandlerArgs<P>) => Promise<Response>,
) {
  return async (request: Request, context: RouteContext<P>): Promise<Response> => {
    try {
      const auth = await getAuthContext(request);
      const params = await context.params;
      return await fn({ request, auth, params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Validation failed", issues: err.issues } },
      { status: 422 },
    );
  }
  if (err instanceof UnauthorisedError) {
    return NextResponse.json({ error: { code: "unauthorised", message: err.message } }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: { code: "forbidden", message: err.message } }, { status: 403 });
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: { code: "not_found", message: err.message } }, { status: 404 });
  }
  if (err instanceof ConflictError) {
    return NextResponse.json({ error: { code: "conflict", message: err.message } }, { status: 409 });
  }
  console.error("API error:", err);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong" } },
    { status: 500 },
  );
}

/** Parse + validate a JSON body against a Zod schema (422 on failure). */
export async function parseBody<T extends ZodTypeAny>(request: Request, schema: T): Promise<z.output<T>> {
  const body = await request.json().catch(() => {
    throw new ZodError([{ code: "custom", message: "Invalid JSON body", path: [] }]);
  });
  return schema.parse(body);
}

export function json(data: unknown, init?: ResponseInit): Response {
  return NextResponse.json(data, init);
}

/** Standard paginated list envelope. */
export function paginated<T>(items: T[], page: number, pageSize: number, total: number) {
  return { items, page, pageSize, total, hasMore: page * pageSize < total };
}

export function getPagination(request: Request): { page: number; pageSize: number } {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 50) || 50));
  return { page, pageSize };
}
