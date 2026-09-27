import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listGuardians } from "@/server/services/guardian.service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import { GuardiansTable, type GuardianRow } from "@/features/guardians/components/guardians-table";
import { AddGuardianDialog } from "@/features/guardians/components/add-guardian-dialog";

export const metadata: Metadata = { title: "Guardians" };

export default async function GuardiansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; relationship?: string }>;
}) {
  const actor = await requirePageActor("guardian.read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const result = await listGuardians(actor, {
    search: sp.q,
    relationship: sp.relationship,
    page,
    pageSize: 20,
  });

  const rows: GuardianRow[] = result.items.map((g) => ({
    id: g.id,
    fullName: g.fullName,
    relationship: g.relationship,
    occupation: g.occupation,
    phone: g.phone,
    email: g.email,
    studentCount: g.studentCount,
    linkedStudents: g.linkedStudents,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Guardians"
        description="Parents and carers, the students they are linked to, and their access rights."
        actions={can(actor, "guardian.create") ? <AddGuardianDialog /> : null}
      />

      <form className="flex flex-wrap items-end gap-2" action="/app/guardians" method="get">
        <div className="max-w-xs flex-1">
          <label htmlFor="q" className="sr-only">
            Search guardians
          </label>
          <Input
            id="q"
            name="q"
            placeholder="Search by name, phone, or email"
            defaultValue={sp.q ?? ""}
          />
        </div>
        <label htmlFor="relationship" className="sr-only">
          Relationship
        </label>
        <Input
          id="relationship"
          name="relationship"
          placeholder="Relationship (e.g. Mother)"
          defaultValue={sp.relationship ?? ""}
          className="max-w-[14rem]"
        />
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No guardians found"
          description={
            sp.q || sp.relationship
              ? "No guardians match these filters. Try clearing the search."
              : "Add your first guardian, then link them to a student."
          }
        />
      ) : (
        <>
          <GuardiansTable rows={rows} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/app/guardians"
            params={{ q: sp.q, relationship: sp.relationship }}
            noun="guardian"
          />
        </>
      )}
    </div>
  );
}
