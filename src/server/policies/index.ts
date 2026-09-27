import type { Actor } from "@/types/actor";
import type { Permission } from "@/lib/permissions";
import { isPermission } from "@/lib/permissions";
import { Errors } from "@/server/errors";

/**
 * The policy layer. This is where "may this actor do X" is answered. The UI uses
 * the same checks for affordances (to hide/disable), but the server is the
 * authority: every service calls one of these before mutating.
 */

/** True if the actor holds the permission. Platform actors pass all checks. */
export function can(actor: Actor, permission: Permission): boolean {
  if (actor.isPlatform) return true;
  if (!isPermission(permission)) return false;
  return actor.permissions.has(permission);
}

/** Throwing variant. Use in services. */
export function authorize(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw Errors.forbidden();
  }
}

/** True if the actor holds at least one of the given permissions. */
export function canAny(actor: Actor, permissions: Permission[]): boolean {
  return permissions.some((p) => can(actor, p));
}

/** True if the actor holds all of the given permissions. */
export function canAll(actor: Actor, permissions: Permission[]): boolean {
  return permissions.every((p) => can(actor, p));
}

/** Throwing variant for "any of". */
export function authorizeAny(actor: Actor, permissions: Permission[]): void {
  if (!canAny(actor, permissions)) throw Errors.forbidden();
}

/**
 * Build a lightweight actor for UI affordance checks. NOTE: never trust a
 * client-constructed actor for authorization; the server always rebuilds the
 * actor from the session.
 */
export function hasRole(actor: Actor, roleKey: string): boolean {
  return actor.isPlatform || actor.roleKeys.includes(roleKey);
}
