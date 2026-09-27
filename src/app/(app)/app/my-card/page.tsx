import type { Metadata } from "next";
import Link from "next/link";
import { IdCard } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { getStudentForCurrentUser, getTenantDisplayName, photoUrl } from "@/server/services/portal-student.service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DigitalStudentCard } from "@/features/attendance/components/digital-student-card";

export const metadata: Metadata = { title: "My ID card" };

export default async function MyCardPage() {
  const actor = await requirePageActor("attendance.read_own");
  const [student, schoolName] = await Promise.all([
    getStudentForCurrentUser(actor),
    getTenantDisplayName(actor),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="My digital ID"
        description="Show this rotating code to your teacher to record attendance. It refreshes automatically."
      />

      {!student ? (
        <EmptyState
          icon={<IdCard />}
          title="No student record is linked to your account"
          description="Your account is not linked to a student record in this school. Ask the school office if this is unexpected."
        />
      ) : (
        <>
          <DigitalStudentCard
            studentId={student.id}
            student={{
              fullName: student.fullName,
              studentNumber: student.studentNumber,
              className: student.className,
              schoolName,
              academicYear: student.academicYear,
              photoUrl: photoUrl(student.photoFileId),
            }}
          />
          <p className="text-xs text-muted-foreground">
            See your{" "}
            <Link href="/app/attendance" className="underline-offset-4 hover:underline">
              attendance history
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
