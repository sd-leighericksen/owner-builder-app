/**
 * API contract tests: every path in the generated OpenAPI spec must resolve to
 * a real route handler exporting the declared method, and a representative
 * request cycle must match the documented shapes (brief §7.7).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildOpenApiDocument } from "@/lib/openapi/document";

process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DIR = "memory://";
process.env.AUTH_MODE = "dev";

const APP_DIR = path.resolve(__dirname, "../src/app");

function routeFileFor(apiPath: string): string {
  // /api/v1/projects/{projectId}/tasks → src/app/api/v1/projects/[projectId]/tasks/route.ts
  const fsPath = apiPath.replace(/^\//, "").replace(/\{(\w+)\}/g, "[$1]");
  return path.join(APP_DIR, fsPath, "route.ts");
}

describe("OpenAPI spec ↔ route handler contract", () => {
  const doc = buildOpenApiDocument();

  it("generates a valid document with security and schemas", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toContain("Owner-Builder");
    expect(Object.keys(doc.paths ?? {}).length).toBeGreaterThanOrEqual(20);
    expect(doc.components?.schemas).toHaveProperty("ProjectCreate");
    expect(doc.components?.schemas).toHaveProperty("TransactionCreate");
    expect(doc.components?.securitySchemes).toHaveProperty("apiKey");
  });

  for (const [apiPath, methods] of Object.entries(buildOpenApiDocument().paths ?? {})) {
    it(`${apiPath} has a route handler for ${Object.keys(methods as object).join(", ")}`, async () => {
      const file = routeFileFor(apiPath);
      expect(fs.existsSync(file), `missing route file ${file}`).toBe(true);
      const mod = await import(file);
      for (const method of Object.keys(methods as object)) {
        expect(mod[method.toUpperCase()], `${apiPath} missing ${method.toUpperCase()}`).toBeTypeOf("function");
      }
    });
  }
});

describe("representative request cycle through route handlers", () => {
  it("creates and reads a project through the HTTP layer", async () => {
    const { seedJurisdictionContent, seedDevAccount } = await import("@/db/seed");
    await seedJurisdictionContent();
    await seedDevAccount();

    const projectsRoute = await import("@/app/api/v1/projects/route");
    const createRes = await projectsRoute.POST(
      new Request("http://test/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Contract test", address: "2 Contract Ct" }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(createRes.status).toBe(201);
    const project = await createRes.json();
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(project.state).toBe("VIC");

    const listRes = await projectsRoute.GET(new Request("http://test/api/v1/projects"), {
      params: Promise.resolve({}),
    });
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items.some((p: { id: string }) => p.id === project.id)).toBe(true);
  });

  it("rejects invalid bodies with 422 and a structured error", async () => {
    const projectsRoute = await import("@/app/api/v1/projects/route");
    const res = await projectsRoute.POST(
      new Request("http://test/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }), // missing address, empty name
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(Array.isArray(body.error.issues)).toBe(true);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const prev = process.env.AUTH_MODE;
    process.env.AUTH_MODE = "";
    try {
      const projectsRoute = await import("@/app/api/v1/projects/route");
      const res = await projectsRoute.GET(new Request("http://test/api/v1/projects"), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(401);
    } finally {
      process.env.AUTH_MODE = prev;
    }
  });
});
