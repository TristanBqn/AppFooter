// Adresse IP du client, pour la limitation de débit par IP sur /auth/* (ADR 007).
// `X-Forwarded-For` n'est lu que si `TRUST_PROXY=true` (sinon usurpable par le client).
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export function getClientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    if (first) return first;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}
