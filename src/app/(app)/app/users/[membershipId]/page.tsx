import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { prisma } from "@/server/db/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserManagePanel } from "@/features/users/components/user-manage-panel";

export const metadata: Metadata = { title: "Manage user" };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const actor = await requirePageActor("user.read");
  const tenantId = requireTenantId(actor);
  const { membershipId } = await params;

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          preferredName: true,
          email: true,
          username: true,
          phone: true,
          status: true,
          lastLoginAt: true,
        },
      },
      userRoles: { select: { role: { select: { id: true, key: true, name: true } } } },
    },
  });
  if (!membership) notFound();

  const roles = await prisma.role.findMany({
    where: { tenantId },
    select: { key: true, name: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  const sessions = can(actor, "user.update")
    ? await prisma.session.findMany({
        where: { userId: membership.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, ipAddress: true, userAgent: true, lastSeenAt: true },
        orderBy: { lastSeenAt: "desc" },
        take: 10,
      })
    : [];

  const canManage = can(actor, "user.update");
  const selectedRoles = membership.userRoles.map((ur) => ur.role.key);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={membership.user.fullName}
        description={membership.title ?? "User details and access"}
        breadcrumbs={[
          { label: "Users", href: "/app/users" },
          { label: membership.user.fullName },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Account details. Email and username must be unique across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Email" value={membership.user.email ?? "-"} />
            <Detail label="Username" value={membership.user.username ?? "-"} />
            <Detail label="Phone" value={membership.user.phone ?? "-"} />
            <Detail label="Account status" value={<Badge variant="outline">{membership.user.status}</Badge>} />
            <Detail
              label="Last sign-in"
              value={
                membership.user.lastLoginAt
                  ? new Date(membership.user.lastLoginAt).toLocaleString()
                  : "Never"
              }
            />
            <Detail label="Added" value={new Date(membership.createdAt).toLocaleDateString()} />
          </div>
        </CardContent>
      </Card>

      {canManage ? (
        <UserManagePanel
          membershipId={membership.id}
          fullName={membership.user.fullName}
          preferredName={membership.user.preferredName ?? ""}
          email={membership.user.email ?? ""}
          username={membership.user.username ?? ""}
          phone={membership.user.phone ?? ""}
          title={membership.title ?? ""}
          roles={roles}
          selectedRoles={selectedRoles}
          membershipStatus={membership.status}
          canResetPassword={can(actor, "user.reset_password")}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {membership.userRoles.map((ur) => (
              <Badge key={ur.role.key} variant="outline">
                {ur.role.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {sessions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active sessions</CardTitle>
            <CardDescription>Devices currently signed in to this account.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-muted-foreground">{s.userAgent ?? "Unknown device"}</span>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {s.ipAddress ?? "-"}
                  </span>
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <p className="text-xs text-muted-foreground">
              Use &quot;Reset password&quot; to sign this user out of all devices.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ruled">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
