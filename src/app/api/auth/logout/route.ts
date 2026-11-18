import { apiHandler, json } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = apiHandler(async () => {
  return clearSessionCookie(json({ ok: true }));
});
