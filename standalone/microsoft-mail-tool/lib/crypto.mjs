import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../.mail-accounts/", import.meta.url));
const keyPath = fileURLToPath(
  new URL("../.mail-accounts/private.key", import.meta.url),
);

function key(create) {
  if (process.env.MAIL_ENCRYPTION_KEY) {
    const bytes = Buffer.from(process.env.MAIL_ENCRYPTION_KEY, "base64");
    if (bytes.length !== 32)
      throw new Error(
        "MAIL_ENCRYPTION_KEY must be 32 bytes encoded as base64.",
      );
    return bytes;
  }
  if (create) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    try {
      writeFileSync(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  let bytes;
  try {
    bytes = readFileSync(keyPath);
  } catch {
    throw new Error(
      "The local encryption key is missing. Authenticate again to create a new connection.",
    );
  }
  if (bytes.length !== 32)
    throw new Error(
      "The local encryption key is invalid. Restore the key or authenticate again.",
    );
  return bytes;
}

export function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(true), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decrypt(value) {
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 28)
    throw new Error("Invalid encrypted connection. Run auth again.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(false),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(12, 28));
  try {
    return Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "Could not decrypt this connection. Restore its original key or run auth again.",
    );
  }
}
