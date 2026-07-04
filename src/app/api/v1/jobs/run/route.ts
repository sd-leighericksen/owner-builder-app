import { NextResponse } from "next/server";
import { runJobs } from "@/lib/services/jobs";
import { errorResponse } from "@/lib/api/handler";

/**
 * Cron entry point (Vercel cron or container cron: `curl -X POST .../jobs/run
 * -H "Authorization: Bearer $CRON_SECRET"`). Emits due/expiring webhook events
 * and delivers pending ones. Not tenant-scoped, so it authenticates with
 * CRON_SECRET rather than a user session.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const header = request.headers.get("authorization");
    if (secret && header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: { code: "unauthorised", message: "Bad cron secret" } }, { status: 401 });
    }
    if (!secret && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: { code: "forbidden", message: "Set CRON_SECRET to enable the jobs route in production" } },
        { status: 403 },
      );
    }
    const result = await runJobs();
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
