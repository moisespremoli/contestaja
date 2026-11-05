import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Encriptação simétrica AES-256-GCM. Formato: v1.<iv>.<tag>.<ciphertext> (base64url).
 * A chave vem de DATA_ENCRYPTION_KEY (32 bytes em base64).
 */
function key(raw = process.env.DATA_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error("DATA_ENCRYPTION_KEY não definida");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("DATA_ENCRYPTION_KEY tem de ter 32 bytes (base64)");
  return buf;
}

export function encryptJson(value: unknown, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(rawKey), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptJson<T = unknown>(payload: string, rawKey?: string): T {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1") throw new Error("Formato de dados encriptados desconhecido");
  const decipher = createDecipheriv("aes-256-gcm", key(rawKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as T;
}

export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Token assinado com expiração: <payload>.<exp>.<sig> */
export function signToken(secret: string, payload: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${Buffer.from(payload).toString("base64url")}.${exp}`;
  return `${body}.${hmac(secret, body)}`;
}

export function verifyToken(secret: string, token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [p, exp, sig] = parts;
  if (!safeEqual(sig, hmac(secret, `${p}.${exp}`))) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return Buffer.from(p, "base64url").toString("utf8");
}
