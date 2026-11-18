import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/lib/types";
import { db } from "@/lib/db";
import { env, hasGoogleAuth, hasSmtp, isProduction } from "@/lib/env";
import { titleCase } from "@/lib/text";

export const SESSION_COOKIE = "rf_session";
export const STATE_COOKIE = "rf_oauth_state";
const SESSION_DAYS = 7;

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function secretBytes(purpose = "session"): Uint8Array {
  const secret = env().AUTH_SECRET;
  if (!secret) {
    if (isProduction()) throw new AuthError("AUTH_SECRET is not configured.", 500);
    return new TextEncoder().encode(`resumeforge-development-only-${purpose}-do-not-use-in-production`);
  }
  return new TextEncoder().encode(`${secret}:${purpose}`);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    image: user.image,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer("resumeforge")
    .setAudience("resumeforge-app")
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretBytes());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretBytes(), { issuer: "resumeforge", audience: "resumeforge-app" });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
      image: typeof payload.image === "string" ? payload.image : null,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
    throw new AuthError("Authentication required.", 401);
  }
  return user;
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieOptions(expiresInDays = SESSION_DAYS) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: expiresInDays * 24 * 60 * 60,
  };
}

export async function setSessionCookie(response: NextResponse, user: SessionUser): Promise<NextResponse> {
  const token = await createSessionToken(user);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return response;
}

/* ------------------------------------------------------------------ */
/* Email one-time codes                                                */
/* ------------------------------------------------------------------ */

function hashCode(email: string, code: string): string {
  return createHmac("sha256", Buffer.from(secretBytes("otp"))).update(`${email.toLowerCase()}:${code}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function requestEmailCode(emailRaw: string): Promise<{ devCode?: string; expiresInMinutes: number }> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) throw new AuthError("Enter a valid email address.", 400);
  const prisma = db();

  const recent = await prisma.authCode.findMany({
    where: { email, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  if (recent.length >= 5) throw new AuthError("Too many codes requested. Wait 10 minutes and try again.", 429);
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30_000) {
    throw new AuthError("A code was just sent. Wait 30 seconds before requesting another.", 429);
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.authCode.create({ data: { email, codeHash: hashCode(email, code), expiresAt } });

  if (hasSmtp()) {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: env().SMTP_HOST,
      port: env().SMTP_PORT,
      secure: env().SMTP_PORT === 465,
      auth: { user: env().SMTP_USER, pass: env().SMTP_PASS },
    });
    await transporter.sendMail({
      from: env().SMTP_FROM,
      to: email,
      subject: `Your ResumeForge sign-in code: ${code}`,
      text: `Your ResumeForge sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not request this, ignore the email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#111827">
        <h1 style="font-size:20px;margin:0 0 12px">Sign in to ResumeForge</h1>
        <p style="color:#4b5563;line-height:1.6">Use this code to finish signing in. It expires in 10 minutes.</p>
        <div style="font-size:32px;letter-spacing:8px;font-weight:700;background:#f3f4f6;border-radius:12px;padding:16px 20px;margin:24px 0;text-align:center">${code}</div>
        <p style="color:#6b7280;font-size:13px">If you did not request this email, you can ignore it.</p>
      </div>`,
    });
  } else if (isProduction() && !env().AUTH_DEV_OTP) {
    throw new AuthError("Email delivery is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.", 503);
  }

  return {
    devCode: hasSmtp() ? undefined : code,
    expiresInMinutes: 10,
  };
}

export async function verifyEmailCode(emailRaw: string, codeRaw: string): Promise<SessionUser> {
  const email = emailRaw.trim().toLowerCase();
  const code = codeRaw.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) throw new AuthError("Enter the 6-digit code.", 400);
  const prisma = db();
  const record = await prisma.authCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) throw new AuthError("No active code for this email. Request a new one.", 400);
  if (record.expiresAt.getTime() < Date.now()) throw new AuthError("This code expired. Request a new one.", 400);
  if (record.attempts >= 5) throw new AuthError("Too many attempts. Request a new code.", 429);

  if (!safeEqual(record.codeHash, hashCode(email, code))) {
    await prisma.authCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new AuthError("That code is incorrect.", 400);
  }

  await prisma.authCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  const name = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const user = await prisma.user.upsert({
    where: { email },
    update: { emailVerified: new Date() },
    create: {
      email,
      name: name ? titleCase(name) : null,
      emailVerified: new Date(),
    },
  });
  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

/* ------------------------------------------------------------------ */
/* Google OAuth                                                       */
/* ------------------------------------------------------------------ */

export async function googleAuthorizeUrl(request: NextRequest): Promise<{ url: string; state: string }> {
  if (!hasGoogleAuth()) throw new AuthError("Google sign-in is not configured.", 400);
  const state = randomInt(0, 1_000_000_000).toString(36) + randomInt(0, 1_000_000_000).toString(36);
  const redirectUri = googleRedirectUri(request);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env().GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");
  return { url: url.toString(), state };
}

export function googleRedirectUri(request: NextRequest): string {
  const base = env().APP_URL || new URL(request.url).origin;
  return `${base.replace(/\/+$/, "")}/api/auth/google/callback`;
}

export async function exchangeGoogleCode(code: string, request: NextRequest): Promise<SessionUser> {
  if (!hasGoogleAuth()) throw new AuthError("Google sign-in is not configured.", 400);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env().GOOGLE_CLIENT_ID!,
      client_secret: env().GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AuthError(`Google token exchange failed. ${detail.slice(0, 160)}`, 400);
  }
  const tokens = (await response.json()) as { id_token?: string; access_token?: string; expires_in?: number };
  if (!tokens.id_token) throw new AuthError("Google did not return an identity token.", 400);

  const { createRemoteJWKSet } = await import("jose");
  const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env().GOOGLE_CLIENT_ID!,
  });
  if (!payload.email || payload.email_verified !== true) throw new AuthError("Google account email is not verified.", 400);

  const email = String(payload.email).toLowerCase();
  const prisma = db();
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      emailVerified: new Date(),
      name: typeof payload.name === "string" ? payload.name : undefined,
      image: typeof payload.picture === "string" ? payload.picture : undefined,
    },
    create: {
      email,
      emailVerified: new Date(),
      name: typeof payload.name === "string" ? payload.name : null,
      image: typeof payload.picture === "string" ? payload.picture : null,
    },
  });

  await prisma.oAuthAccount.upsert({
    where: { provider_providerAccountId: { provider: "GOOGLE", providerAccountId: String(payload.sub) } },
    update: { userId: user.id, accessToken: tokens.access_token ?? null, expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null },
    create: {
      userId: user.id,
      provider: "GOOGLE",
      providerAccountId: String(payload.sub),
      accessToken: tokens.access_token ?? null,
      expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
    },
  });

  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

export function googleEnabled(): boolean {
  return hasGoogleAuth();
}
