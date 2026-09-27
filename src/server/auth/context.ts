import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, resolveActorFromCookie } from "@/server/auth/session";
import type { Actor } from "@/types/actor";

/**
 * Request-scoped actor resolution for Server Components, Route Handlers, and
 * Server Actions. Always resolve the actor on the server from the session; never
 * trust a client-supplied identity.
 */

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
};

export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  return { ip, userAgent: h.get("user-agent") };
}

/** Resolve the current actor, or null when unauthenticated. */
export async function getActor(): Promise<Actor | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE)?.value;
  const meta = await getRequestMeta();
  return resolveActorFromCookie(cookieValue, meta);
}

/** Resolve the current actor or throw a 401-shaped error. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) {
    const { Errors } = await import("@/server/errors");
    throw Errors.unauthenticated();
  }
  return actor;
}

/** Read the raw session cookie value (for session management operations). */
export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}
