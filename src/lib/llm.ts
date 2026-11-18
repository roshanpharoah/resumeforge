import { z } from "zod";
import { sanityDisclaimer } from "@/prompts/shared";

/**
 * Minimal OpenAI-compatible client. Works with OpenAI, Azure OpenAI gateways,
 * OpenRouter, Together, Groq, Ollama and most self-hosted gateways.
 * If no key is configured the app falls back to deterministic generators.
 */

export interface LlmCallOptions<T> {
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  raw?: string;
}

class LlmTimeoutError extends Error {}

export async function callLlm<T>(options: LlmCallOptions<T>): Promise<LlmResult<T>> {
  const { env } = await import("@/lib/env");
  const config = env();
  if (!config.LLM_API_KEY) {
    return { ok: false, error: "LLM is not configured." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);
  const endpoint = `${config.LLM_BASE_URL.replace(/\/+$/, "")}/chat/completions`;
  const baseBody = {
    model: config.LLM_MODEL,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 3000,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
  };

  try {
    let response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        ...baseBody,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: options.schemaName,
            strict: true,
            schema: options.jsonSchema,
          },
        },
      }),
      signal: controller.signal,
    });

    // Gateways that do not support json_schema fall back to json_object.
    if (!response.ok && (response.status === 400 || response.status === 422)) {
      await response.text().catch(() => "");
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.LLM_API_KEY}`,
        },
        body: JSON.stringify({
          ...baseBody,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: `LLM request failed (${response.status}). ${text.slice(0, 400)}` };
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (payload.error) return { ok: false, error: payload.error.message ?? "LLM error" };
    const content = payload.choices?.[0]?.message?.content ?? "";
    if (!content) return { ok: false, error: "LLM returned an empty response.", raw: content };

    const json = extractJson(content);
    if (!json.ok) return { ok: false, error: "LLM returned invalid JSON.", raw: content };
    const parsed = options.schema.safeParse(json.value);
    if (!parsed.success) {
      return {
        ok: false,
        error: `LLM output did not match the ${options.schemaName} schema: ${parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
        raw: content,
      };
    }
    return { ok: true, data: parsed.data, raw: content };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "LLM request timed out." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "LLM request failed." };
  } finally {
    clearTimeout(timeout);
  }
}

function extractJson(content: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return { ok: true, value: JSON.parse(trimmed.slice(first, last + 1)) };
      } catch {
        return { ok: false };
      }
    }
    return { ok: false };
  }
}

export function llmStatus(): { configured: boolean; disclaimer: string } {
  // Keep this synchronous for UI; env availability is enough.
  return {
    configured: Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL),
    disclaimer: sanityDisclaimer,
  };
}
