"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { createEntry, deleteEntry } from "@/server/services/timetable.service";

export type TimetableResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createEntryAction(input: {
  academicYearId: string;
  classroomId: string;
  subjectId: string;
  teacherId?: string;
  roomId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}): Promise<TimetableResult> {
  try {
    const actor = await requireActor();
    const entry = await createEntry(actor, input);
    revalidatePath("/app/timetable");
    return { ok: true, id: entry.id };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function deleteEntryAction(id: string): Promise<TimetableResult> {
  try {
    const actor = await requireActor();
    await deleteEntry(actor, id);
    revalidatePath("/app/timetable");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}
