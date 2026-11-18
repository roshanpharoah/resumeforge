import { mkdir, readFile as fsReadFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { hasS3, env } from "@/lib/env";
import { HttpError } from "@/lib/api";

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

function sanitizeKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/");
  if (parts.some((p) => !p || p === "." || p === "..")) throw new HttpError(400, "Invalid file key.");
  return parts.join("/");
}

function localPath(key: string): string {
  const safe = sanitizeKey(key);
  const full = path.join(LOCAL_ROOT, safe);
  if (!full.startsWith(LOCAL_ROOT)) throw new HttpError(400, "Invalid file key.");
  return full;
}

export interface StoredFile {
  key: string;
  size: number;
  storage: "s3" | "local";
}

export async function putFile(key: string, buffer: Buffer, contentType: string): Promise<StoredFile> {
  const safe = sanitizeKey(key);
  if (hasS3()) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: env().S3_REGION,
      endpoint: env().S3_ENDPOINT,
      forcePathStyle: env().S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env().S3_ACCESS_KEY_ID!, secretAccessKey: env().S3_SECRET_ACCESS_KEY! },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: env().S3_BUCKET!,
        Key: safe,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
    );
    return { key: safe, size: buffer.length, storage: "s3" };
  }

  const full = localPath(safe);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return { key: safe, size: buffer.length, storage: "local" };
}

export async function getFile(key: string): Promise<{ body: Buffer; contentType: string }> {
  const safe = sanitizeKey(key);
  if (hasS3()) {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: env().S3_REGION,
      endpoint: env().S3_ENDPOINT,
      forcePathStyle: env().S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env().S3_ACCESS_KEY_ID!, secretAccessKey: env().S3_SECRET_ACCESS_KEY! },
    });
    const result = await client.send(new GetObjectCommand({ Bucket: env().S3_BUCKET!, Key: safe }));
    if (!result.Body) throw new HttpError(404, "File not found.");
    const body = Buffer.from(await result.Body.transformToByteArray());
    return { body, contentType: result.ContentType ?? contentTypeFor(safe) };
  }
  try {
    const body = await fsReadFile(localPath(safe));
    return { body, contentType: contentTypeFor(safe) };
  } catch {
    throw new HttpError(404, "File not found.");
  }
}

export async function deleteFile(key: string): Promise<void> {
  const safe = sanitizeKey(key);
  if (hasS3()) {
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: env().S3_REGION,
      endpoint: env().S3_ENDPOINT,
      forcePathStyle: env().S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env().S3_ACCESS_KEY_ID!, secretAccessKey: env().S3_SECRET_ACCESS_KEY! },
    });
    await client.send(new DeleteObjectCommand({ Bucket: env().S3_BUCKET!, Key: safe }));
    return;
  }
  await unlink(localPath(safe)).catch(() => undefined);
}

export function contentTypeFor(key: string): string {
  const ext = key.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export function storageLabel(): string {
  return hasS3() ? "S3-compatible object storage" : "Local disk (.data/uploads)";
}
