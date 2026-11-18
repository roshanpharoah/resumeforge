import { apiHandler, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { hasGoogleAuth, hasLlm, hasS3, hasSmtp } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const user = await getSessionUser();
  return json({
    user,
    config: {
      googleEnabled: hasGoogleAuth(),
      llmConfigured: hasLlm(),
      emailConfigured: hasSmtp(),
      storage: hasS3() ? "s3" : "local",
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      devOtp: process.env.NODE_ENV !== "production" && !hasSmtp(),
    },
  });
});
