import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let _db: Db | null = null;

/**
 * Returns the app database. Two drivers:
 * - default: real Postgres (Supabase managed or self-hosted) via DATABASE_URL
 * - DB_DRIVER=pglite: embedded in-process Postgres for local dev/demo, stored
 *   in .pglite/ — lets the app run with zero external services.
 */
export async function getDb(): Promise<Db> {
  if (_db) return _db;

  if (process.env.DB_DRIVER === "pglite") {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR ?? ".pglite/data";
    if (!dir.startsWith("memory://")) {
      const { mkdirSync } = await import("node:fs");
      const { dirname } = await import("node:path");
      mkdirSync(dirname(dir), { recursive: true });
    }
    const client = new PGlite(dir);
    const db = drizzlePglite(client, { schema });
    await runPgliteMigrations(client);
    _db = db;
    return _db;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (or set DB_DRIVER=pglite for embedded dev mode)");
  const client = postgres(url, { prepare: false }); // prepare:false → PgBouncer/Supavisor safe
  _db = drizzlePostgres(client, { schema });
  return _db;
}

// PGlite can't use drizzle-kit's CLI migrator at runtime; apply committed SQL
// migrations directly, tracking them in a local table.
async function runPgliteMigrations(client: import("@electric-sql/pglite").PGlite) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "src/db/migrations");
  if (!fs.existsSync(dir)) return;
  await client.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())`,
  );
  const applied = new Set(
    (await client.query<{ name: string }>(`SELECT name FROM _migrations`)).rows.map((r) => r.name),
  );
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.exec(trimmed);
    }
    await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
  }
}

export { schema };
