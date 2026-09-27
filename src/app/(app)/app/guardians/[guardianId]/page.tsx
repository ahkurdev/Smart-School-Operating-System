import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import {
  getGuardian,
  listStudentsAvailableForGuardian,
} from "@/server/services/guardian.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EditGuardianDialog } from "@/features/guardians/components/edit-guardian-dialog";
import { LinkStudentDialog } from "@/features/guardians/components/link-student-dialog";
import {
  LinkedStudentsList,
  type LinkedStudent,
} from "@/features/guardians/components/linked-students-list";
import type { GuardianFormValues } from "@/features/guardians/components/guardian-form";

export const metadata: Metadata = { title: "Guardian" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ruled">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value || "-"}</p>
    </div>
  );
}

export default async function GuardianDetailPage({
  params,
}: {
  params: Promise<{ guardianId: string }>;
}) {
  const actor = await requirePageActor("guardian.read");
  const { guardianId } = await params;

  let guardian: Awaited<ReturnType<typeof getGuardian>>;
  try {
    guardian = await getGuardian(actor, guardianId);
  } catch {
    notFound();
  }

  const showNationalId = can(actor, "guardian.read");
  const canLink = can(actor, "guardian.link");

  const availableStudents = canLink
    ? await listStudentsAvailableForGuardian(actor, guardianId)
    : [];

  const formValues: GuardianFormValues = {
    id: guardian.id,
    fullName: guardian.fullName,
    relationship: guardian.relationship,
    nationalId: guardian.nationalId ?? "",
    occupation: guardian.occupation ?? "",
    phone: guardian.phone ?? "",
    email: guardian.email ?? "",
    address: guardian.address ?? "",
  };

  const links: LinkedStudent[] = guardian.students.map((s) => ({
    id: s.student.id,
    fullName: s.student.fullName,
    studentNumber: s.student.studentNumber,
    status: s.student.status,
    relationship: s.relationship,
    isPrimary: s.isPrimary,
    canPickup: s.canPickup,
    hasPortalAccess: s.hasPortalAccess,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={guardian.fullName}
        description={guardian.relationship}
        breadcrumbs={[
          { label: "Guardians", href: "/app/guardians" },
          { label: guardian.fullName },
        ]}
        actions={
          can(actor, "guardian.update") ? (
            <EditGuardianDialog
              values={formValues}
              canArchive={can(actor, "guardian.delete")}
            />
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Contact details and identity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Detail label="Relationship" value={guardian.relationship} />
            <Detail
              label="National ID"
              value={
                showNationalId && guardian.nationalId ? (
                  <span className="tabular">{guardian.nationalId}</span>
                ) : guardian.nationalId ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Lock className="size-3.5" aria-hidden /> Restricted
                  </span>
                ) : (
                  "-"
                )
              }
            />
            <Detail label="Occupation" value={guardian.occupation} />
            <Detail label="Phone" value={guardian.phone} />
            <Detail label="Email" value={guardian.email} />
            <Detail
              label="Portal access"
              value={guardian.userId ? <Badge variant="success">Linked</Badge> : "No account"}
            />
          </div>
          {guardian.address ? (
            <div className="mt-4">
              <Detail label="Address" value={guardian.address} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Linked students</CardTitle>
              <CardDescription>Students this guardian is responsible for.</CardDescription>
            </div>
            {canLink && availableStudents.length > 0 ? (
              <LinkStudentDialog guardianId={guardian.id} students={availableStudents} />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {links.length > 0 ? (
            <LinkedStudentsList guardianId={guardian.id} links={links} canLink={canLink} />
          ) : (
            <EmptyState
              title="No students linked"
              description={
                canLink
                  ? "Link a student so this guardian can access their progress and be contacted."
                  : "No students are linked to this guardian yet."
              }
            />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Link href="/app/guardians" className="underline-offset-4 hover:underline">
          Back to guardians
        </Link>
      </p>
    </div>
  );
}
