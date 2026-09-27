import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import {
  signAttendanceToken,
  verifyAttendanceToken,
  type AttendanceTokenPayload,
} from "@/server/auth/signing";
import { randomToken } from "@/server/auth/random";
import { getEnv } from "@/lib/env";
import type { Actor } from "@/types/actor";

/**
 * Dynamic QR attendance.
 *
 * Issuance (student side): the student requests a token; the server verifies the
 * student exists in the same tenant, is actively enrolled, and that a session is
 * currently open for their class. It mints a short-lived signed token
 * (v/tid/sid/iat/exp/nonce) and records the nonce server-side so it can be
 * consumed exactly once.
 *
 * Consumption (teacher side): the scanner posts the raw token; the server
 * verifies the signature, expiry, tenant, nonce (unconsumed), and that the
 * student is enrolled in the open session being scanned. Only then does it
 * create the attendance record, consume the nonce, and write an audit entry.
 *
 * No name, photo, or national id is ever placed in the QR payload.
 */

const CLOCK_SKEW_SECONDS = 5;

/** Issue a rotating token for the currently-authenticated student. */
export async function issueAttendanceToken(
  actor: Actor,
  params: { studentId: string; sessionId?: string },
): Promise<{ token: string; expiresAt: Date; student: { id: string; fullName: string; studentNumber: string; className: string | null; photoFileId: string | null } }> {
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findFirst({
    where: { id: params.studentId, tenantId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      studentNumber: true,
      photoFileId: true,
      enrollments: {
        where: { status: "ACTIVE" },
        select: { classroom: { select: { id: true, name: true } } },
        orderBy: { enrolledAt: "desc" },
        take: 1,
      },
    },
  });
  if (!student) throw Errors.notFound("That student was not found.");
  const enrollment = student.enrollments[0];
  if (!enrollment) {
    throw Errors.conflict("This student has no active enrollment, so attendance cannot be taken.");
  }

  const ttl = getEnv().ATTENDANCE_TOKEN_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const nonce = randomToken(16);
  const payload: AttendanceTokenPayload = {
    v: 1,
    tid: tenantId,
    sid: student.id,
    iat: now,
    exp: now + ttl,
    nonce,
  };
  const token = await signAttendanceToken(payload);

  await prisma.attendanceToken.create({
    data: {
      tenantId,
      studentId: student.id,
      sessionId: params.sessionId || null,
      nonce,
      issuedAt: new Date(now * 1000),
      expiresAt: new Date((now + ttl) * 1000),
    },
  });

  return {
    token,
    expiresAt: new Date((now + ttl) * 1000),
    student: {
      id: student.id,
      fullName: student.fullName,
      studentNumber: student.studentNumber,
      className: enrollment.classroom?.name ?? null,
      photoFileId: student.photoFileId,
    },
  };
}

export type ScanPreview = {
  student: {
    id: string;
    fullName: string;
    studentNumber: string;
    className: string | null;
    photoFileId: string | null;
  };
  session: { id: string; title: string | null; classroomName: string | null };
  alreadyMarked: { status: string; scanTime: Date } | null;
  suggestedStatus: "PRESENT" | "LATE";
};

/**
 * Verify a scanned token and return an identity confirmation card WITHOUT
 * committing attendance. The teacher then confirms separately.
 */
export async function previewScan(
  actor: Actor,
  params: { token: string; sessionId: string },
): Promise<ScanPreview> {
  authorize(actor, "attendance.scan");
  const tenantId = requireTenantId(actor);

  const session = await prisma.attendanceSession.findFirst({
    where: { id: params.sessionId, tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      startAt: true,
      gracePeriodMinutes: true,
      classroomId: true,
      classroom: { select: { name: true } },
    },
  });
  if (!session) throw Errors.notFound("That attendance session was not found.");
  if (session.status !== "OPEN") {
    throw Errors.conflict("Attendance can only be taken in an open session.");
  }

  const verified = await verifyAttendanceToken(params.token);
  if (!verified.ok) {
    const msg =
      verified.reason === "expired"
        ? "This QR code has expired. Ask the student to refresh it."
        : "This QR code is not valid.";
    throw Errors.validation(msg, { token: [msg] });
  }
  const p = verified.payload;
  if (p.tid !== tenantId) {
    throw Errors.forbidden("This QR code belongs to a different school.");
  }
  if (Date.now() / 1000 > p.exp + CLOCK_SKEW_SECONDS) {
    throw Errors.validation("This QR code has expired.");
  }

  const tokenRow = await prisma.attendanceToken.findFirst({
    where: { nonce: p.nonce, tenantId },
    select: { id: true, consumedAt: true, studentId: true },
  });
  if (!tokenRow) throw Errors.validation("This QR code is not recognised.");
  if (tokenRow.consumedAt) {
    throw Errors.conflict("This QR code has already been used.");
  }

  const student = await prisma.student.findFirst({
    where: { id: p.sid, tenantId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      studentNumber: true,
      photoFileId: true,
      enrollments: {
        where: { status: "ACTIVE" },
        select: { classroomId: true, classroom: { select: { name: true } } },
      },
    },
  });
  if (!student) throw Errors.validation("This student was not found.");
  // The scanned student must be enrolled in THIS session's class.
  const inThisClass = student.enrollments.some((e) => e.classroomId === session.classroomId);
  if (!inThisClass) {
    throw Errors.validation("This student is not enrolled in this session's class.");
  }

  const existing = await prisma.attendanceRecord.findFirst({
    where: { sessionId: session.id, studentId: student.id },
    select: { status: true, scanTime: true },
  });

  const lateThreshold = new Date(session.startAt.getTime() + session.gracePeriodMinutes * 60_000);
  const now = new Date();
  return {
    student: {
      id: student.id,
      fullName: student.fullName,
      studentNumber: student.studentNumber,
      className: student.enrollments[0]?.classroom?.name ?? null,
      photoFileId: student.photoFileId,
    },
    session: { id: session.id, title: session.title, classroomName: session.classroom?.name ?? null },
    alreadyMarked: existing ? { status: existing.status, scanTime: existing.scanTime } : null,
    suggestedStatus: now > lateThreshold ? "LATE" : "PRESENT",
  };
}

/**
 * Commit a confirmed scan. Consumes the nonce in a transaction and creates the
 * attendance record; duplicate scans are rejected by the nonce check plus the
 * DB unique constraint on (sessionId, studentId).
 */
export async function confirmScan(
  actor: Actor,
  params: { token: string; sessionId: string; status?: "PRESENT" | "LATE" },
) {
  authorize(actor, "attendance.scan");
  const tenantId = requireTenantId(actor);

  const verified = await verifyAttendanceToken(params.token);
  if (!verified.ok) throw Errors.validation("This QR code is not valid.");
  const p = verified.payload;
  if (p.tid !== tenantId) throw Errors.forbidden("This QR code belongs to a different school.");

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.attendanceSession.findFirst({
      where: { id: params.sessionId, tenantId },
      select: { id: true, status: true, classroomId: true, startAt: true, gracePeriodMinutes: true },
    });
    if (!session) throw Errors.notFound("Session not found.");
    if (session.status !== "OPEN") throw Errors.conflict("This session is not open.");

    // Consume the nonce atomically: only one concurrent confirm can win.
    const consumed = await tx.attendanceToken.updateMany({
      where: { nonce: p.nonce, tenantId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date(), consumedByUserId: actor.userId },
    });
    if (consumed.count === 0) {
      throw Errors.conflict("This QR code has already been used or has expired.");
    }

    const tokenRow = await tx.attendanceToken.findFirst({
      where: { nonce: p.nonce, tenantId },
      select: { id: true, studentId: true },
    });
    const studentId = tokenRow!.studentId;

    if (!session.classroomId) throw Errors.conflict("This session has no class assigned.");
    const enrolled = await tx.enrollment.findFirst({
      where: { tenantId, studentId, classroomId: session.classroomId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!enrolled) throw Errors.validation("This student is not enrolled in this class.");

    const existing = await tx.attendanceRecord.findFirst({
      where: { sessionId: session.id, studentId },
      select: { id: true },
    });
    if (existing) throw Errors.conflict("Attendance for this student is already recorded.");

    const lateThreshold = new Date(session.startAt.getTime() + session.gracePeriodMinutes * 60_000);
    const status = params.status ?? (new Date() > lateThreshold ? "LATE" : "PRESENT");

    const record = await tx.attendanceRecord.create({
      data: {
        tenantId,
        sessionId: session.id,
        studentId,
        status,
        method: "QR",
        tokenId: tokenRow!.id,
      },
      select: { id: true, status: true, scanTime: true },
    });
    return { record, studentId };
  });

  await recordAudit({
    actor,
    action: "attendance.confirm",
    resource: "AttendanceRecord",
    resourceId: result.record.id,
    after: { studentId: result.studentId, status: result.record.status },
  });
  return result.record;
}

/**
 * Open session for the student's class today (if any), used by the digital card
 * to explain whether a scan would currently be accepted.
 */
export async function getOpenSessionForStudentClass(actor: Actor, studentId: string) {
  const tenantId = requireTenantId(actor);
  const enrollment = await prisma.enrollment.findFirst({
    where: { tenantId, studentId, status: "ACTIVE" },
    select: { classroomId: true },
    orderBy: { enrolledAt: "desc" },
  });
  if (!enrollment) return null;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return prisma.attendanceSession.findFirst({
    where: {
      tenantId,
      classroomId: enrollment.classroomId,
      status: "OPEN",
      sessionDate: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true, title: true },
    orderBy: { startAt: "asc" },
  });
}
