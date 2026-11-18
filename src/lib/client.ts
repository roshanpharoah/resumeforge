import type { FactCheckResult } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  code?: string;
  constructor(message: string, status: number, details?: unknown, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const message = (payload && typeof payload.error === "string" && payload.error) || `Request failed with ${response.status}.`;
    if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    throw new ApiError(message, response.status, payload?.details, payload?.code);
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again.";
}

export function factCheckFromError(error: unknown): FactCheckResult | null {
  if (!(error instanceof ApiError)) return null;
  const details = error.details as { factCheck?: FactCheckResult } | undefined;
  return details?.factCheck ?? null;
}

export async function downloadExport(path: string, body: unknown, fallbackName: string): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.error ?? "Export failed.", response.status, payload?.details, payload?.code);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = match?.[1] ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function filenameFor(format: string, name?: string | null): string {
  const base = (name || "resume")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "resume";
  return `${base}.${format}`;
}

export function makeId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Immutable set by dot path, supports numeric array indexes. */
export function setByPath<T>(source: T, path: string, value: unknown): T {
  const parts = path.split(".");
  const clone = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map((item) => clone(item));
    if (input && typeof input === "object") return { ...(input as Record<string, unknown>) };
    return input;
  };
  const root = clone(source) as Record<string, unknown>;
  let cursor: unknown = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (cursor === null || typeof cursor !== "object") return source;
    const container = cursor as Record<string, unknown>;
    const next = container[key];
    const cloned = clone(next);
    container[key] = cloned;
    cursor = cloned;
  }
  if (cursor && typeof cursor === "object") {
    (cursor as Record<string, unknown>)[parts[parts.length - 1]] = value;
  }
  return root as T;
}
