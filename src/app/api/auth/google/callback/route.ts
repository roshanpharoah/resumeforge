import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api";
import { exchangeGoogleCode, setSessionCookie, STATE_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export const GET = apiHandler(async (request: NextRequest) => {
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Google sign in was cancelled.")}`, request.url));
  }
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const raw = request.cookies.get(STATE_COOKIE)?.value;
  let stored: { state?: string; next?: string } = {};
  try {
    stored = raw ? (JSON.parse(raw) as { state?: string; next?: string }) : {};
  } catch {
    stored = {};
  }
  if (!code || !state || !stored.state || stored.state !== state) {
    return NextResponse.redirect(new URL("/login?error=Google%20sign%20in%20could%20not%20be%20verified.", request.url));
  }

  try {
    const user = await exchangeGoogleCode(code, request);
    const response = NextResponse.redirect(new URL(safeNext(stored.next), request.url));
    response.cookies.delete(STATE_COOKIE);
    return setSessionCookie(response, user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign in failed.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message.slice(0, 180))}`, request.url));
  }
});
