import { json } from "@/lib/api";
import { db } from "@/lib/db";
import { hasGoogleAuth, hasLlm, hasS3, hasSmtp } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "unconfigured" | "unreachable" = "unconfigured";
  let databaseError: string | null = null;
  if (process.env.DATABASE_URL) {
    try {
      await db().$queryRaw`SELECT 1`;
      database = "ok";
    } catch (error) {
      database = "unreachable";
      databaseError = error instanceof Error ? error.message.slice(0, 240) : "Database query failed.";
    }
  }
  return json(
    {
      ok: database === "ok",
      time: new Date().toISOString(),
      checks: {
        database,
        databaseError,
        llm: hasLlm() ? "configured" : "rules fallback",
        googleAuth: hasGoogleAuth() ? "configured" : "disabled",
        email: hasSmtp() ? "configured" : "dev code in response",
        storage: hasS3() ? "s3" : "local disk",
      },
    },
    { status: 200 },
  );
}
