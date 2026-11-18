import type { NextRequest } from "next/server";
import { apiHandler, json, rateLimit } from "@/lib/api";
import { setSessionCookie, verifyEmailCode } from "@/lib/auth";
import { verifyCodeSchema } from "@/lib/requests";

export const runtime = "nodejs";

export const POST = apiHandler(async (request: NextRequest) => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const body = verifyCodeSchema.parse(await request.json());
  rateLimit(`verify:ip:${ip}`, 20, 10 * 60 * 1000);
  const user = await verifyEmailCode(body.email, body.code);
  const response = json({ ok: true, user });
  return setSessionCookie(response, user);
});
