import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

/**
 * Signed, expiring, unguessable links (booking confirm/cancel/reschedule, walk-in status).
 * Format: base64url(json{k,id,exp}).base64url(hmac-sha256). Nothing is stored; tampering fails verification.
 */
export type TokenKind = "booking" | "walkin";
const TTL: Record<TokenKind, number> = { booking: 60 * 60 * 24 * 120, walkin: 60 * 60 * 12 };

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (data: string) => createHmac("sha256", serverEnv().APP_TOKEN_SECRET).update(data).digest();

export function signToken(kind: TokenKind, id: string, ttlSeconds = TTL[kind]): string {
  const payload = b64(JSON.stringify({ k: kind, id, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${payload}.${b64(mac(payload))}`;
}

export function verifyToken(token: string, kind: TokenKind): { id: string } | null {
  if (typeof token !== "string" || token.length > 400) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = mac(payload);
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { k?: string; id?: string; exp?: number };
    if (data.k !== kind || typeof data.id !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: data.id };
  } catch {
    return null;
  }
}
