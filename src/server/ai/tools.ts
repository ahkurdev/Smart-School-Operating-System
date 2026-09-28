import type { Actor } from "@/types/actor";
import type { Permission } from "@/lib/permissions";
import { can } from "@/server/policies";
import { attendanceTrend, enrollmentByGrade, admissionsFunnel, financeTrend, academicRiskIndicators, teacherWorkload, libraryUsage } from "@/server/services/reporting.service";
import { listStudents, getStudent } from "@/server/services/student.service";

/**
 * AI tool layer (Phase 85).
 *
 * Each tool is a narrow, named capability with (a) a required permission, (b) a
 * JSON-schema parameter block for the model, and (c) a handler that itself calls
 * the normal service functions - which re-run authorization and tenant scoping.
 * The assistant never receives database access: only the tools it is allowed to
 * call, and only within the caller's tenant and permissions.
 *
 * Results are small and pre-aggregated so no raw PII is dumped into a prompt.
 */

export type AiToolContext = { actor: Actor };

export type AiTool = {
  name: string;
  description: string;
  /** Permission the caller must hold for this tool to be offered/called. */
  permission: Permission;
  parameters: Record<string, unknown>;
  /** Roles this tool is primarily intended for (used to shape the toolset). */
  contexts: ("admin" | "teacher" | "student" | "parent")[];
  handler: (ctx: AiToolContext, args: Record<string, unknown>) => Promise<unknown>;
};

function daysArg(args: Record<string, unknown>, fallback = 30): number {
  const n = Number(args.days);
  return Number.isFinite(n) && n > 0 && n <= 120 ? Math.floor(n) : fallback;
}

export const AI_TOOLS: AiTool[] = [
  {
    name: "getAttendanceSummary",
    description: "Summarise attendance for the last N days: overall rate, absences, lateness and a short daily series.",
    permission: "reporting.read",
    contexts: ["admin", "teacher"],
    parameters: { type: "object", properties: { days: { type: "number", description: "Look-back window in days (default 30)" } }, additionalProperties: false },
    handler: async ({ actor }, args) => {
      const to = new Date();
      const from = new Date(to.getTime() - daysArg(args) * 24 * 60 * 60 * 1000);
      const t = await attendanceTrend(actor, { from, to });
      return { rate: t.rate, present: t.present, late: t.late, absent: t.absent, period: t.period, series: t.series.slice(-10) };
    },
  },
  {
    name: "getEnrollmentSummary",
    description: "Summarise active enrollment counts by grade level.",
    permission: "reporting.read",
    contexts: ["admin"],
    parameters: { type: "object", properties: {}, additionalProperties: false },
    handler: ({ actor }) => enrollmentByGrade(actor),
  },
  {
    name: "getAdmissionsFunnel",
    description: "Summarise applicant counts by status for the admissions funnel.",
    permission: "admission.read",
    contexts: ["admin"],
    parameters: { type: "object", properties: {}, additionalProperties: false },
    handler: ({ actor }) => admissionsFunnel(actor),
  },
  {
    name: "getFinanceSummary",
    description: "Summarise billed, collected and outstanding fees by month.",
    permission: "finance.read",
    contexts: ["admin"],
    parameters: { type: "object", properties: {}, additionalProperties: false },
    handler: async ({ actor }) => {
      const trend = await financeTrend(actor);
      return { months: trend.slice(-6) };
    },
  },
  {
    name: "getTeacherWorkload",
    description: "List teachers with their number of assigned classes.",
    permission: "reporting.read",
    contexts: ["admin"],
    parameters: { type: "object", properties: {}, additionalProperties: false },
    handler: ({ actor }) => teacherWorkload(actor),
  },
  {
    name: "getLibraryUsage",
    description: "Summarise library loans: total, active and overdue.",
    permission: "library.read",
    contexts: ["admin"],
    parameters: { type: "object", properties: {}, additionalProperties: false },
    handler: ({ actor }) => libraryUsage(actor),
  },
  {
    name: "getAcademicRisk",
    description: "Explainable academic-risk indicators for students over the last N days, with contributing factors.",
    permission: "reporting.read",
    contexts: ["admin", "teacher"],
    parameters: { type: "object", properties: { days: { type: "number" }, limit: { type: "number" } }, additionalProperties: false },
    handler: async ({ actor }, args) => {
      const { period, indicators } = await academicRiskIndicators(actor, { days: daysArg(args) });
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));
      return {
        period,
        note: "Indicators for human review; not predictions or diagnoses.",
        indicators: indicators.slice(0, limit).map((r) => ({ student: r.studentNumber, level: r.level, factors: r.factors })),
      };
    },
  },
  {
    name: "searchStudents",
    description: "Search students by name or number. Returns only non-sensitive identity fields.",
    permission: "student.read",
    contexts: ["admin", "teacher"],
    parameters: { type: "object", properties: { query: { type: "string", description: "Name or student number fragment" } }, required: ["query"], additionalProperties: false },
    handler: async ({ actor }, args) => {
      const query = String(args.query ?? "").trim();
      const { items } = await listStudents(actor, { search: query, pageSize: 10 });
      return {
        query,
        results: items.map((s) => ({ id: s.id, name: s.fullName, studentNumber: s.studentNumber })),
      };
    },
  },
  {
    name: "getStudentSummary",
    description: "Return a single student's identity summary (requires student.read).",
    permission: "student.read",
    contexts: ["admin", "teacher"],
    parameters: { type: "object", properties: { studentId: { type: "string" } }, required: ["studentId"], additionalProperties: false },
    handler: async ({ actor }, args) => {
      const s = await getStudent(actor, String(args.studentId ?? ""));
      return { id: s.id, name: s.fullName, studentNumber: s.studentNumber, status: s.status };
    },
  },
];

export function toolSchemasFor(actor: Actor, context: AiTool["contexts"][number] | "any" = "any") {
  return AI_TOOLS.filter((t) => can(actor, t.permission) && (context === "any" || t.contexts.includes(context))).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function findTool(name: string): AiTool | undefined {
  return AI_TOOLS.find((t) => t.name === name);
}
