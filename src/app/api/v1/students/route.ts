import type { NextRequest } from "next/server";
import { authenticateApiRequest, apiOk, apiError } from "@/server/api/v1/guard";
import { listStudents } from "@/server/services/student.service";
import { isAppError } from "@/server/errors";
import "@/server/jobs";

/**
 * GET /api/v1/students — list students for the key's tenant.
 * Scope: students.read. Only non-sensitive identity fields are returned.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, "students.read");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? "25"));

  try {
    const result = await listStudents(auth.actor, { search, page: Number.isFinite(page) ? page : 1, pageSize: Number.isFinite(pageSize) ? pageSize : 25 });
    return apiOk({
      items: result.items.map((s) => ({ id: s.id, studentNumber: s.studentNumber, fullName: s.fullName, status: s.status })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (e) {
    if (isAppError(e)) return apiError(e.status, e.code, e.userMessage);
    throw e;
  }
}
