/**
 * Secrets storage: prefers OS keychain (keytar), falls back to encrypted local file.
 * Tokens are stored as JSON blobs keyed by `accountId`.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BACKEND = (process.env.SECRET_BACKEND ?? "keychain").toLowerCase();
const SERVICE = "smf-clawpost";

let keytar: typeof import("keytar") | null = null;
if (BACKEND === "keychain") {
  try {
    keytar = await import("keytar");
  } catch {
    console.warn("[secrets] keytar unavailable, falling back to encrypted env file");
  }
}

const FALLBACK_DIR = resolve("./data/.tokens");
const FALLBACK_FILE = resolve(FALLBACK_DIR, "tokens.enc");

function getKey(): Buffer {
  const hex = process.env.MASTER_KEY;
  if (!hex) {
    // Derive a stable but unique key from machine + db path. Not ideal — production should set MASTER_KEY.
    return createHash("sha256").update(`clawpost:${process.env.DATABASE_PATH ?? ""}`).digest();
  }
  return Buffer.from(hex, "hex");
}

function encryptBlob(data: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptBlob(b64: string): string {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function readFallback(): Record<string, string> {
  if (!existsSync(FALLBACK_FILE)) return {};
  try {
    return JSON.parse(decryptBlob(readFileSync(FALLBACK_FILE, "utf8")));
  } catch {
    return {};
  }
}

function writeFallback(map: Record<string, string>) {
  mkdirSync(FALLBACK_DIR, { recursive: true });
  writeFileSync(FALLBACK_FILE, encryptBlob(JSON.stringify(map)), "utf8");
}

export async function setSecret(accountId: string, value: object): Promise<void> {
  const serialized = JSON.stringify(value);
  if (keytar) {
    await keytar.setPassword(SERVICE, accountId, serialized);
    return;
  }
  const map = readFallback();
  map[accountId] = serialized;
  writeFallback(map);
}

export async function getSecret<T = unknown>(accountId: string): Promise<T | null> {
  if (keytar) {
    const v = await keytar.getPassword(SERVICE, accountId);
    return v ? (JSON.parse(v) as T) : null;
  }
  const map = readFallback();
  const v = map[accountId];
  return v ? (JSON.parse(v) as T) : null;
}

export async function deleteSecret(accountId: string): Promise<void> {
  if (keytar) {
    await keytar.deletePassword(SERVICE, accountId);
    return;
  }
  const map = readFallback();
  delete map[accountId];
  writeFallback(map);
}
