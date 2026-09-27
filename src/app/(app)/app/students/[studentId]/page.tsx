import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { getStudent } from "@/server/services/student.service";
import { listCampuses } from "@/server/services/tenant.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EditStudentDialog } from "@/features/students/components/edit-student-dialog";
import type { StudentFormValues } from "@/features/students/components/student-form";

export const metadata: Metadata = { title: "Student" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ruled">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value || "-"}</p>
    </div>
  );
}

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const actor = await requirePageActor("student.read");
  const tenantId = requireTenantId(actor);
  const { studentId } = await params;

  let student: Awaited<ReturnType<typeof getStudent>>;
  try {
    student = await getStudent(actor, studentId);
  } catch {
    notFound();
  }
  const campuses = await listCampuses(tenantId);
  const canSeeSensitive = can(actor, "student.read_sensitive");

  const formValues: StudentFormValues = {
    id: student.id,
    fullName: student.fullName,
    preferredName: student.preferredName ?? "",
    studentNumber: student.studentNumber,
    nationalId: student.nationalId ?? "",
    gender: student.gender ?? "",
    birthDate: toDateInput(student.birthDate),
    birthPlace: student.birthPlace ?? "",
    nationality: student.nationality ?? "",
    religion: student.religion ?? "",
    address: student.address ?? "",
    city: student.city ?? "",
    region: student.region ?? "",
    country: student.country ?? "",
    postalCode: student.postalCode ?? "",
    email: student.email ?? "",
    phone: student.phone ?? "",
    emergencyContactName: student.emergencyContactName ?? "",
    emergencyContactPhone: student.emergencyContactPhone ?? "",
    medicalNotes: student.medicalNotes ?? "",
    specialEdNotes: student.specialEdNotes ?? "",
    campusId: student.campus?.id ?? "",
    status: student.status,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={student.fullName}
        description={`${student.studentNumber}${student.campus ? ` · ${student.campus.name}` : ""}`}
        breadcrumbs={[{ label: "Students", href: "/app/students" }, { label: student.fullName }]}
        actions={
          can(actor, "student.update") ? (
            <EditStudentDialog
              values={formValues}
              campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
              canSeeSensitive={canSeeSensitive}
              canArchive={can(actor, "student.delete")}
            />
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Identity and contact details.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Detail label="Student number" value={<span className="tabular">{student.studentNumber}</span>} />
            <Detail label="Status" value={<Badge variant="outline">{student.status}</Badge>} />
            <Detail label="Gender" value={student.gender ?? "-"} />
            <Detail label="Date of birth" value={student.birthDate ? new Date(student.birthDate).toLocaleDateString() : "-"} />
            <Detail label="Place of birth" value={student.birthPlace} />
            <Detail label="Nationality" value={student.nationality} />
            <Detail label="Email" value={student.email} />
            <Detail label="Phone" value={student.phone} />
            <Detail
              label="Campus"
              value={student.campus?.name ?? "-"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollment</CardTitle>
          <CardDescription>Classes and academic years this student belongs to.</CardDescription>
        </CardHeader>
        <CardContent>
          {student.enrollments.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {student.enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-medium">{e.classroom?.name ?? "Unassigned"}</span>
                  <span className="text-muted-foreground">{e.academicYear?.name ?? "-"}</span>
                  <Badge variant="outline">{e.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Not enrolled yet"
              description="Assign this student to a class for the current academic year."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guardians</CardTitle>
          <CardDescription>Parents and guardians linked to this student.</CardDescription>
        </CardHeader>
        <CardContent>
          {student.guardians.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {student.guardians.map((g) => (
                <li key={g.guardian.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">
                      {g.guardian.fullName}{" "}
                      {g.isPrimary ? <Badge variant="success">Primary</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {g.relationship} · {g.guardian.phone ?? g.guardian.email ?? "No contact"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No guardians linked"
              description="Link a parent or guardian so they can access this student's progress."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restricted notes</CardTitle>
          <CardDescription>Medical and learning-support information.</CardDescription>
        </CardHeader>
        <CardContent>
          {canSeeSensitive ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Medical notes" value={student.medicalNotes} />
              <Detail label="Learning support" value={student.specialEdNotes} />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden />
              You do not have permission to view restricted notes.
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Link href="/app/students" className="underline-offset-4 hover:underline">
          Back to students
        </Link>
      </p>
    </div>
  );
}
