import { prisma } from "@/server/db/client";
import { requireTenantId } from "@/server/db/tenant";
import type { Actor } from "@/types/actor";

/**
 * Resolve the Student record for the signed-in user, if any. A user is a student
 * when a Student row references their userId. Used by the student portal and the
 * digital attendance card so a student can only ever address their own record.
 */
export async function getStudentForCurrentUser(actor: Actor) {
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findFirst({
    where: { tenantId, userId: actor.userId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      studentNumber: true,
      photoFileId: true,
      enrollments: {
        where: { status: "ACTIVE" },
        select: {
          classroom: { select: { name: true } },
          academicYear: { select: { name: true, isCurrent: true } },
        },
        orderBy: { enrolledAt: "desc" },
        take: 1,
      },
    },
  });
  if (!student) return null;
  const enrollment = student.enrollments[0];
  return {
    id: student.id,
    fullName: student.fullName,
    studentNumber: student.studentNumber,
    photoFileId: student.photoFileId,
    className: enrollment?.classroom?.name ?? null,
    academicYear: enrollment?.academicYear?.name ?? null,
  };
}

/** Photo URL for a FileObject-backed photo, via the secure file route. */
export function photoUrl(fileId: string | null): string | null {
  if (!fileId) return null;
  return `/api/files/${fileId}`;
}

/** Public school display name for the digital card header. */
export async function getTenantDisplayName(actor: Actor): Promise<string> {
  const tenantId = requireTenantId(actor);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  return tenant?.name ?? "School";
}
