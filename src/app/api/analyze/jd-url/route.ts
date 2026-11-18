import { lookup } from "dns/promises";
import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { jdUrlSchema } from "@/lib/requests";
import { extractJd } from "@/lib/keywords";

export const runtime = "nodejs";
export const maxDuration = 30;

function isPrivateAddress(address: string): boolean {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (/^127\./.test(address) || /^10\./.test(address) || /^192\.168\./.test(address) || /^169\.254\./.test(address)) return true;
  const match = /^172\.(\d+)\./.exec(address);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (/^fc00:/i.test(address) || /^fd00:/i.test(address) || /^fe80:/i.test(address)) return true;
  return false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new HttpError(400, "Only http and https links are supported.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new HttpError(400, "That address is not reachable from the app.");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateAddress(host)) {
    throw new HttpError(400, "Private network addresses are not allowed.");
  }
  try {
    const records = await lookup(host, { all: true });
    if (records.some((record) => isPrivateAddress(record.address))) {
      throw new HttpError(400, "That link resolves to a private network address.");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "That domain could not be resolved.");
  }
  return url;
}

function htmlToText(html: string): { text: string; title: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, title };
}

export const POST = apiHandler(async (request: Request) => {
  await requireApiUser();
  const body = jdUrlSchema.parse(await request.json());
  const url = await assertPublicUrl(body.url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "ResumeForgeBot/1.0 (job description reader)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
      },
    });
  } catch {
    throw new HttpError(422, "That page could not be loaded. Paste the job description text instead.");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new HttpError(422, `That page returned ${response.status}. Paste the job description text instead.`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 4 * 1024 * 1024) throw new HttpError(413, "That page is too large to read. Paste the job description text instead.");
  const raw = await response.text();
  if (raw.length > 4 * 1024 * 1024) throw new HttpError(413, "That page is too large to read. Paste the job description text instead.");
  const contentType = response.headers.get("content-type") || "";
  const parsed = contentType.includes("html") ? htmlToText(raw) : { text: raw.trim(), title: "" };
  if (parsed.text.length < 80) throw new HttpError(422, "The page did not contain enough readable text. Paste the job description manually.");

  const extracted = extractJd(parsed.text, parsed.title, "");
  return json({
    url: url.toString(),
    title: parsed.title,
    text: parsed.text.slice(0, 60_000),
    extracted,
    llmUsed: false,
  });
});
