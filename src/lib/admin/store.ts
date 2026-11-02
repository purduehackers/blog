import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { required, setting } from "./config.ts";

// A dedicated Redis database is recommended. Every key is namespaced.
export function key(value: string): string {
  return `${setting("NEWSLETTER_REDIS_PREFIX", "ph-newsletter:")}${value}`;
}
export async function redis<T = unknown>(
  ...command: (string | number)[]
): Promise<T> {
  const url = new URL(required("UPSTASH_REDIS_REST_URL"));
  if (url.protocol !== "https:") throw new Error("Redis REST must use HTTPS.");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("UPSTASH_REDIS_REST_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new Error(`Newsletter storage unavailable (${response.status}).`);
  const data = (await response.json()) as { result: T; error?: string };
  if (data.error) throw new Error("Newsletter storage command failed.");
  return data.result;
}
export async function read<T>(name: string): Promise<T | null> {
  const value = await redis<string | null>("GET", key(name));
  return value === null ? null : (JSON.parse(value) as T);
}
export async function write(
  name: string,
  value: unknown,
  ttl?: number,
): Promise<void> {
  await redis(
    "SET",
    key(name),
    JSON.stringify(value),
    ...(ttl ? ["EX", ttl] : []),
  );
}
export function opaque(): string {
  return randomBytes(32).toString("base64url");
}
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function encryptionKey(): Buffer {
  const value = Buffer.from(required("NEWSLETTER_ENCRYPTION_KEY"), "base64");
  if (value.length !== 32)
    throw new Error(
      "NEWSLETTER_ENCRYPTION_KEY must be 32 random bytes encoded as base64.",
    );
  return value;
}
export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
export function decrypt(value: string): string {
  const bytes = Buffer.from(value, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    bytes.subarray(0, 12),
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
// Release only our own lease. Used for token refresh and campaign editing.
export async function locked<T>(
  name: string,
  action: () => Promise<T>,
): Promise<T> {
  const owner = opaque();
  if (
    (await redis("SET", key(`lock:${name}`), owner, "NX", "EX", 120)) !== "OK"
  ) {
    throw new Error("Another operation is running. Try again in two minutes.");
  }
  try {
    return await action();
  } finally {
    await redis(
      "EVAL",
      "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
      1,
      key(`lock:${name}`),
      owner,
    );
  }
}
