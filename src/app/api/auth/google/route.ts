import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api";
import { googleAuthorizeUrl, STATE_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const next = request.nextUrl.searchParams.get("next") || "/dashboard";
  const { url, state } = await googleAuthorizeUrl(request);
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
});
