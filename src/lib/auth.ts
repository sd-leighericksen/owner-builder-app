import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { accountMembers, apiKeys } from "@/db/schema";

export interface AuthContext {
  userId: string;
  accountId: string;
  role: "owner" | "admin" | "member" | "readonly";
  via: "session" | "api_key" | "dev";
}

export class UnauthorisedError extends Error {
  constructor(message = "Unauthorised") {
    super(message);
    this.name = "UnauthorisedError";
  }
}

const DEV_ACCOUNT_ID = "00000000-0000-7000-8000-000000000001";
const DEV_USER_ID = "00000000-0000-7000-8000-0000000000aa";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Resolve the caller for an API request. Order:
 * 1. API key (Authorization: Bearer ob_...) — machine access for n8n etc.
 * 2. Supabase session cookie (email/password or Google via Supabase Auth).
 * 3. AUTH_MODE=dev — seeded dev owner. Local development only.
 */
export async function getAuthContext(request: Request): Promise<AuthContext> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ob_")) {
    return authViaApiKey(authHeader.slice("Bearer ".length));
  }

  if (supabaseConfigured()) {
    const ctx = await authViaSupabaseSession();
    if (ctx) return ctx;
  }

  if (process.env.AUTH_MODE === "dev") {
    return { userId: DEV_USER_ID, accountId: DEV_ACCOUNT_ID, role: "owner", via: "dev" };
  }

  throw new UnauthorisedError();
}

async function authViaApiKey(key: string): Promise<AuthContext> {
  const db = await getDb();
  const keyHash = hashApiKey(key);
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt), isNull(apiKeys.deletedAt)));
  const apiKey = rows[0];
  if (!apiKey) throw new UnauthorisedError("Invalid API key");
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKey.id));
  return {
    userId: apiKey.createdBy ?? apiKey.id,
    accountId: apiKey.accountId,
    role: "member",
    via: "api_key",
  };
}

async function authViaSupabaseSession(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* read-only in route handlers; middleware refreshes sessions */
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const db = await getDb();
  const memberships = await db
    .select()
    .from(accountMembers)
    .where(eq(accountMembers.userId, data.user.id));
  const membership = memberships[0];
  if (!membership) throw new UnauthorisedError("No account membership for this user");
  return {
    userId: data.user.id,
    accountId: membership.accountId,
    role: membership.role,
    via: "session",
  };
}
