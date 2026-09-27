"use server";

import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { issueAttendanceToken, getOpenSessionForStudentClass } from "@/server/services/qr-attendance.service";
import { can } from "@/server/policies";

export type AttendanceTokenResult =
  | {
      ok: true;
      token: string;
      expiresAt: string;
      student: { id: string; fullName: string; studentNumber: string; className: string | null; photoFileId: string | null };
      openSession: { id: string; title: string | null } | null;
    }
  | { ok: false; message: string };

/**
 * Issue a fresh rotating attendance token for the signed-in student. The client
 * calls this on a timer (never the server pushing); the QR never contains PII.
 */
export async function issueAttendanceTokenAction(studentId: string): Promise<AttendanceTokenResult> {
  try {
    const actor = await requireActor();
    if (!can(actor, "attendance.read_own") && !can(actor, "attendance.scan")) {
      return { ok: false, message: "You are not allowed to request an attendance token." };
    }
    const [res, openSession] = await Promise.all([
      issueAttendanceToken(actor, { studentId }),
      getOpenSessionForStudentClass(actor, studentId).catch(() => null),
    ]);
    return {
      ok: true,
      token: res.token,
      expiresAt: res.expiresAt.toISOString(),
      student: res.student,
      openSession: openSession ? { id: openSession.id, title: openSession.title } : null,
    };
  } catch (e) {
    if (isAppError(e)) return { ok: false, message: e.userMessage };
    console.error("issueAttendanceTokenAction failed", e);
    return { ok: false, message: "Could not issue a token right now." };
  }
}
