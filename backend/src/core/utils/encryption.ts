import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "../../config/env.js";

// security.md: application-level envelope encryption (AES-256-GCM).
// TOKEN_ENCRYPTION_KEY is a dev-local stand-in for a KMS-managed master
// key (design spec: docs/superpowers/specs/2026-08-13-backend-implementation-design.md).
const ALGORITHM = "aes-256-gcm";
const key = createHash("sha256").update(env.TOKEN_ENCRYPTION_KEY).digest();

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
