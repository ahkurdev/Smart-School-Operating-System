import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/context";
import { can } from "@/server/policies";
import type { Permission } from "@/lib/permissions";
import type { Actor } from "@/types/actor";

/**
 * Page guard for Server Components. Resolves the actor and redirects to sign-in
 * (unauthenticated) or the forbidden page (unauthorised). Returns the actor so
 * the page can use it without resolving twice.
 */
export async function requirePageActor(permission?: Permission): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (permission && !can(actor, permission)) redirect("/app/forbidden");
  return actor;
}
