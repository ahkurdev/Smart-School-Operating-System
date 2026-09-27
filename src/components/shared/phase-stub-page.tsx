import { requirePageActor } from "@/server/auth/guards";
import { PhaseStub } from "@/components/shared/phase-stub";
import type { Permission } from "@/lib/permissions";

/**
 * Renders a shared "coming online" panel for a route whose module is scheduled
 * for a later phase. It still enforces the route's read permission so that the
 * permission model is honest even before the feature exists.
 */
export async function PhaseStubPage({
  title,
  permission,
  description,
}: {
  title: string;
  permission: Permission;
  description?: string;
}) {
  await requirePageActor(permission);
  return <PhaseStub title={title} description={description} />;
}
