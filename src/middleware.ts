import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PROTECTED = ["/dashboard", "/resumes", "/onboarding", "/applications", "/jobs", "/tools", "/settings"];
const AUTH_PAGES = ["/login"];

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET || "resumeforge-development-only-session-do-not-use-in-production";
  return new TextEncoder().encode(`${value}:session`);
}

async function validSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret(), { issuer: "resumeforge", audience: "resumeforge-app" });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("rf_session")?.value;
  const authed = await validSession(token);

  if (PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/resumes/:path*", "/onboarding/:path*", "/applications/:path*", "/jobs/:path*", "/tools/:path*", "/settings/:path*", "/login"],
};
