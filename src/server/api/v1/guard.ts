import { NextResponse, type NextRequest } from "next/server";
import { resolveApiKey, hasScope, type ApiScope } from "@/server/services/integration.service";
import type { Actor } from "@/types/actor";

/**
 * Public API v1 helpers (Phase 90).
 *
 * Integrations authenticate with an `Authorization: Bearer sk_…` key. We resolve
 * the key to a tenant + scope set and build a server-side Actor whose permission
 * set is the union of the scopes (mapped to internal permissions). The normal
 * services then run with that actor, so tenant isolation and field visibility are
 * exactly the same as the UI - never bypassed for the API.
 */

const SCOPE_TO_PERMISSIONS: Record<ApiScope, string[]> = {
  "students.read": ["student.read"],
  "attendance.read": ["attendance.read", "reporting.read"],
  "finance.read": ["finance.read"],
  "admissions.read": ["admission.read"],
  "library.read": ["library.read"],
  "webhooks.manage": ["apikey.manage"],
};

export type ApiAuth = { actor: Actor; scopes: ApiScope[] } | { error: NextResponse };

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function authenticateApiRequest(request: NextRequest, requiredScope: ApiScope): Promise<ApiAuth> {
  const resolved = await resolveApiKey(request.headers.get("authorization"));
  if (!resolved) {
    return { error: apiError(401, "UNAUTHENTICATED", "Provide a valid API key via Authorization: Bearer.") };
  }
  if (!hasScope(resolved.scopes, requiredScope)) {
    return { error: apiError(403, "FORBIDDEN", `This key lacks the ${requiredScope} scope.`) };
  }
  const permissions = new Set<string>();
  for (const scope of resolved.scopes) for (const p of SCOPE_TO_PERMISSIONS[scope] ?? []) permissions.add(p);

  const actor: Actor = {
    userId: `apikey:${resolved.keyId}`,
    tenantId: resolved.tenantId,
    permissions: permissions as Actor["permissions"],
    isPlatform: false,
    roleKeys: ["api"],
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
  return { actor, scopes: resolved.scopes };
}

/** Standard success envelope. */
export function apiOk<T>(data: T) {
  return NextResponse.json({ data });
}
