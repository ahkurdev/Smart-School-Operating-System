import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listRolesWithPermissions, groupPermissions } from "@/server/services/role.service";
import { PageHeader } from "@/components/ui/page-header";
import { RoleCard } from "@/features/roles/components/role-card";
import { CreateRoleDialog } from "@/features/roles/components/create-role-dialog";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const actor = await requirePageActor("role.read");
  const [roles, groups] = await Promise.all([
    listRolesWithPermissions(actor),
    Promise.resolve(groupPermissions()),
  ]);

  const canManage = can(actor, "role.update");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Roles and permissions"
        description="What each role can see and do in this school. Roles are per-school and can be customised."
        actions={can(actor, "role.create") ? <CreateRoleDialog groups={groups} /> : null}
      />

      <div className="space-y-4">
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} groups={groups} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}
