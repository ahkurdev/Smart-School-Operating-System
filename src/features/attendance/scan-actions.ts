"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createSession,
  openSession,
  closeSession,
  cancelSession,
  manualMark,
  getSessionRoster,
  listSessions,
  getSessionSummary,
} from "@/server/services/attendance.service";
import { previewScan, confirmScan, type ScanPreview } from "@/server/services/qr-attendance.service";

export type AttendanceActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export type ScanResult = { ok: true; preview: ScanPreview } | { ok: false; message: string };

function fail(e: unknown): AttendanceActionResult {
  if (isAppError(e)) return { ok: false, message: e.userMessage, fieldErrors: e.details };
  console.error("attendance action failed", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function createSessionAction(
  _prev: AttendanceActionResult | undefined,
  formData: FormData,
): Promise<AttendanceActionResult> {
  const parsed = z
    .object({
      classroomId: z.string().min(1, "Choose a class."),
      subjectId: z.string().optional(),
      academicYearId: z.string().optional(),
      title: z.string().optional(),
      sessionDate: z.string().min(1),
      startAt: z.string().min(1),
      endAt: z.string().min(1),
      gracePeriodMinutes: z.coerce.number().int().min(0).max(60).default(10),
    })
    .safeParse({
      classroomId: formData.get("classroomId"),
      subjectId: formData.get("subjectId") ?? "",
      academicYearId: formData.get("academicYearId") ?? "",
      title: formData.get("title") ?? "",
      sessionDate: formData.get("sessionDate"),
      startAt: formData.get("startAt"),
      endAt: formData.get("endAt"),
      gracePeriodMinutes: formData.get("gracePeriodMinutes") ?? 10,
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    const d = parsed.data;
    const res = await createSession(actor, {
      classroomId: d.classroomId,
      subjectId: d.subjectId || undefined,
      academicYearId: d.academicYearId || undefined,
      title: d.title,
      sessionDate: new Date(d.sessionDate),
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
      gracePeriodMinutes: d.gracePeriodMinutes,
    });
    revalidatePath("/app/attendance");
    return { ok: true, message: "Session created.", id: res.id };
  } catch (e) {
    return fail(e);
  }
}

export async function openSessionAction(sessionId: string): Promise<AttendanceActionResult> {
  try {
    const actor = await requireActor();
    await openSession(actor, sessionId);
    revalidatePath("/app/attendance");
    revalidatePath(`/app/attendance/${sessionId}`);
    return { ok: true, message: "Session opened." };
  } catch (e) {
    return fail(e);
  }
}

export async function closeSessionAction(sessionId: string): Promise<AttendanceActionResult> {
  try {
    const actor = await requireActor();
    await closeSession(actor, sessionId);
    revalidatePath("/app/attendance");
    revalidatePath(`/app/attendance/${sessionId}`);
    return { ok: true, message: "Session closed." };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelSessionAction(sessionId: string): Promise<AttendanceActionResult> {
  try {
    const actor = await requireActor();
    await cancelSession(actor, sessionId);
    revalidatePath("/app/attendance");
    return { ok: true, message: "Session cancelled." };
  } catch (e) {
    return fail(e);
  }
}

export async function previewScanAction(token: string, sessionId: string): Promise<ScanResult> {
  try {
    const actor = await requireActor();
    const preview = await previewScan(actor, { token, sessionId });
    return { ok: true, preview };
  } catch (e) {
    if (isAppError(e)) return { ok: false, message: e.userMessage };
    console.error("previewScanAction failed", e);
    return { ok: false, message: "Could not read that QR code." };
  }
}

export async function confirmScanAction(
  token: string,
  sessionId: string,
  status?: "PRESENT" | "LATE",
): Promise<AttendanceActionResult> {
  try {
    const actor = await requireActor();
    const res = await confirmScan(actor, { token, sessionId, status });
    revalidatePath(`/app/attendance/${sessionId}`);
    return { ok: true, message: `Attendance recorded (${res.status}).`, id: res.id };
  } catch (e) {
    return fail(e);
  }
}

export async function manualMarkAction(
  _prev: AttendanceActionResult | undefined,
  formData: FormData,
): Promise<AttendanceActionResult> {
  const parsed = z
    .object({
      sessionId: z.string().min(1),
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "LATE", "EXCUSED", "SICK", "ABSENT", "LEAVE"]),
      reason: z.string().optional(),
    })
    .safeParse({
      sessionId: formData.get("sessionId"),
      studentId: formData.get("studentId"),
      status: formData.get("status"),
      reason: formData.get("reason") ?? "",
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    const res = await manualMark(actor, {
      sessionId: parsed.data.sessionId,
      studentId: parsed.data.studentId,
      status: parsed.data.status,
      reason: parsed.data.reason,
    });
    revalidatePath(`/app/attendance/${parsed.data.sessionId}`);
    return { ok: true, message: `Marked ${res.status}.`, id: res.id };
  } catch (e) {
    return fail(e);
  }
}

export async function refreshRosterAction(sessionId: string) {
  try {
    const actor = await requireActor();
    const [roster, summary] = await Promise.all([
      getSessionRoster(actor, sessionId),
      getSessionSummary(actor, sessionId),
    ]);
    return { ok: true as const, students: roster.students, summary };
  } catch {
    return { ok: false as const, students: [], summary: [] };
  }
}

export async function listSessionsAction(date?: string) {
  try {
    const actor = await requireActor();
    return await listSessions(actor, date ? { date: new Date(date) } : {});
  } catch {
    return [];
  }
}
