import type { NextRequest } from "next/server";
import { authenticateApiRequest, apiOk, apiError } from "@/server/api/v1/guard";
import { attendanceTrend } from "@/server/services/reporting.service";
import { isAppError } from "@/server/errors";
import "@/server/jobs";

/**
 * GET /api/v1/attendance/summary?days=30 — attendance rate + series.
 * Scope: attendance.read.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, "attendance.read");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const days = Math.min(120, Math.max(1, Number(searchParams.get("days") ?? "30") || 30));
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    const summary = await attendanceTrend(auth.actor, { from, to });
    return apiOk(summary);
  } catch (e) {
    if (isAppError(e)) return apiError(e.status, e.code, e.userMessage);
    throw e;
  }
}
