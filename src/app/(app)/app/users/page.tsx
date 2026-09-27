import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listUsers, listTenantRoles } from "@/server/services/user.service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsersTable, type UserRow } from "@/features/users/components/users-table";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const actor = await requirePageActor("user.read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const [result, roles] = await Promise.all([
    listUsers(actor, {
      search: sp.q,
      status: (sp.status as "ACTIVE" | "INVITED" | "INACTIVE") || undefined,
      page,
      pageSize: 20,
    }),
    listTenantRoles(actor),
  ]);

  const rows: UserRow[] = result.items.map((u) => ({
    membershipId: u.membershipId,
    userId: u.userId,
    fullName: u.fullName,
    email: u.email,
    username: u.username,
    title: u.title,
    userStatus: u.userStatus,
    membershipStatus: u.membershipStatus,
    roles: u.roles,
    lastLoginAt: u.lastLoginAt,
  }));

  const canManage = can(actor, "user.update");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Users"
        description="Accounts in this school, their roles, and their access status."
        actions={canManage ? <CreateUserDialog roles={roles.map((r) => ({ key: r.key, name: r.name }))} /> : null}
      />

      <form className="flex flex-wrap items-end gap-2" action="/app/users" method="get">
        <div className="max-w-xs flex-1">
          <label htmlFor="q" className="sr-only">
            Search users
          </label>
          <Input id="q" name="q" placeholder="Search by name or email" defaultValue={sp.q ?? ""} />
        </div>
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INVITED">Invited</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<UserCog />}
          title="No users found"
          description={
            sp.q || sp.status
              ? "No users match these filters. Try clearing the search."
              : "Add your first user, or import staff and students from a CSV."
          }
        />
      ) : (
        <>
          <UsersTable rows={rows} canManage={canManage} />
          <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/app/users" params={{ q: sp.q, status: sp.status }} />
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const link = (p: number) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
    usp.set("page", String(p));
    return `${basePath}?${usp.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <p className="tabular">
        {total} {total === 1 ? "user" : "users"} · page {page} of {Math.max(1, totalPages)}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <a href={link(page - 1)}>Previous</a>
          </Button>
        ) : null}
        {page < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <a href={link(page + 1)}>Next</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
