import type { NextRequest } from "next/server";
import { apiHandler, json, rateLimit } from "@/lib/api";
import { requestEmailCode } from "@/lib/auth";
import { requestCodeSchema } from "@/lib/requests";
import { isProduction } from "@/lib/env";

export const runtime = "nodejs";

export const POST = apiHandler(async (request: NextRequest) => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const body = requestCodeSchema.parse(await request.json());
  rateLimit(`code:ip:${ip}`, 10, 10 * 60 * 1000);
  rateLimit(`code:email:${body.email.toLowerCase()}`, 5, 10 * 60 * 1000);
  const result = await requestEmailCode(body.email);
  return json({
    ok: true,
    expiresInMinutes: result.expiresInMinutes,
    ...(result.devCode ? { devCode: result.devCode } : {}),
    ...(!isProduction() && !result.devCode ? { hint: "Email is configured, so the code was sent by email." } : {}),
  });
});
