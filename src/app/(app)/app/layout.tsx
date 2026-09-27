import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getActor } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/policies";
import { filterNav } from "@/components/layout/nav-config";
import { AppSidebar, AppSidebarMobile } from "@/components/layout/app-sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { Toaster } from "@/components/ui/sonner";
import type { Permission } from "@/lib/permissions";

/**
 * The authenticated admin/portal shell. Resolves the actor, filters navigation by
 * permission and feature flags, and renders the sidebar + topbar. Routes below
 * this layout inherit the actor context via getActor().
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  // Platform admins with no tenant selected see a chooser rather than the app.
  let tenantName = "Platform";
  let featureFlags: Record<string, boolean> = {};
  if (actor.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: actor.tenantId },
      select: { name: true, featureFlags: true, status: true },
    });
    if (!tenant || tenant.status !== "ACTIVE") {
      redirect("/app/no-access");
    }
    tenantName = tenant.name;
    featureFlags = (tenant.featureFlags as Record<string, boolean> | null) ?? {};
  }

  const groups = filterNav(
    (permission: Permission) => can(actor, permission),
    (flag: string) => featureFlags[flag] !== false,
  );

  const memberships = await prisma.membership.findMany({
    where: { userId: actor.userId, status: "ACTIVE", tenant: { status: "ACTIVE" } },
    select: { tenantId: true, tenant: { select: { name: true, slug: true } } },
    orderBy: { tenant: { name: "asc" } },
  });

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { fullName: true, email: true },
  });

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar groups={groups} tenantName={tenantName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur sm:px-4">
          <div className="flex items-center gap-2 lg:hidden">
            <AppSidebarMobile groups={groups} tenantName={tenantName} />
          </div>
          <Link
            href="/app"
            className="hidden items-center gap-2 font-display text-sm font-semibold text-foreground lg:flex"
          >
            <GraduationCap className="size-4 text-primary" aria-hidden />
            Smart School OS
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu
              user={{
                fullName: user?.fullName ?? "Account",
                email: user?.email ?? null,
                isPlatform: actor.isPlatform,
              }}
              activeTenantId={actor.tenantId}
              tenants={memberships.map((m) => ({
                tenantId: m.tenantId,
                name: m.tenant.name,
                slug: m.tenant.slug,
              }))}
            />
          </div>
        </header>

        <main id="main-content" className="flex-1 px-3 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
