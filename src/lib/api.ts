import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { Prisma } from "@prisma/client";
import { AuthError, getSessionUser } from "@/lib/auth";
import { DocumentParseError } from "@/lib/parse-file";
import type { SessionUser } from "@/lib/types";

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function json<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "Check the highlighted fields.", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return parsed.data;
}

export function apiHandler<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message, details: error.details }, { status: error.status });
      }
      if (error instanceof AuthError) {
        return json({ error: error.message }, { status: error.status });
      }
      if (error instanceof ZodError) {
        return json(
          { error: "Validation failed.", details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
          { status: 400 },
        );
      }
      if (error instanceof DocumentParseError) {
        return json({ error: error.message, code: error.code }, { status: error.code === "TOO_LARGE" ? 413 : 422 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") return json({ error: "That record already exists." }, { status: 409 });
        if (error.code === "P2025") return json({ error: "Record not found." }, { status: 404 });
        if (error.code === "P1001" || error.code === "P1017") {
          return json({ error: "The database is not reachable. Check DATABASE_URL and run migrations." }, { status: 503 });
        }
      }
      if (error instanceof Prisma.PrismaClientInitializationError) {
        return json({ error: "The database is not configured. Set DATABASE_URL and run prisma migrate deploy." }, { status: 503 });
      }
      console.error("[api] unhandled error", error);
      return json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}

export async function assertOwned<T extends { userId: string }>(record: Promise<T | null>, userId: string, label = "Record"): Promise<T> {
  const value = await record;
  if (!value || value.userId !== userId) throw new HttpError(404, `${label} not found.`);
  return value;
}

/* ------------------------------------------------------------------ */
/* Best-effort in-memory rate limiting. Use Redis in a multi-instance  */
/* deployment. The interface is deliberately small so it can be       */
/* swapped without touching route code.                                */
/* ------------------------------------------------------------------ */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > limit) {
    throw new HttpError(429, "Too many requests. Wait a moment and try again.");
  }
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
}

export function apiEnabled(): boolean {
  return true;
}
