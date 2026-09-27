import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { getSession, getSessionRoster, getSessionSummary } from "@/server/services/attendance.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AttendanceScanner } from "@/features/attendance/components/attendance-scanner";
import { SessionControls } from "@/features/attendance/components/session-controls";
import { ManualMarkDialog, type RosterStudent } from "@/features/attendance/components/manual-mark-dialog";

export const metadata: Metadata = { title: "Attendance session" };

const STATUS_VARIANT: Record<string, "outline" | "success" | "warning" | "destructive" | "info"> = {
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "destructive",
  EXCUSED: "info",
  SICK: "info",
  LEAVE: "info",
};

export default async function SessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await requirePageActor("attendance.read");
  const { sessionId } = await params;

  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession(actor, sessionId);
  } catch {
    notFound();
  }

  const [roster, summary] = await Promise.all([
    getSessionRoster(actor, sessionId),
    getSessionSummary(actor, sessionId),
  ]);
  const students = roster.students as RosterStudent[];
  const byStatus = Object.fromEntries(summary.map((s) => [s.status, s.count]));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={session.title ?? session.classroom?.name ?? "Attendance session"}
        description={`${session.classroom?.name ?? "No class"}${session.subject ? ` · ${session.subject.name}` : ""} · ${
          session.teacher?.fullName ?? "No teacher"
        }`}
        breadcrumbs={[{ label: "Attendance", href: "/app/attendance" }, { label: "Session" }]}
        actions={can(actor, "attendance.manage") ? <SessionControls sessionId={session.id} status={session.status} /> : null}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={session.status === "OPEN" ? "success" : "outline"}>{session.status}</Badge>
        {Object.entries(byStatus).map(([st, n]) => (
          <Badge key={st} variant={STATUS_VARIANT[st] ?? "outline"}>
            {st}: {n}
          </Badge>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {session.status === "OPEN" && can(actor, "attendance.scan") ? (
          <AttendanceScanner sessionId={session.id} canOverride={can(actor, "attendance.override")} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scanning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {session.status === "OPEN"
                  ? "You do not have permission to scan attendance."
                  : "Open the session to start scanning student QR codes."}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Roster <span className="tabular text-muted-foreground">({students.length})</span>
            </CardTitle>
            {can(actor, "attendance.override") && session.status !== "CANCELLED" ? (
              <ManualMarkDialog session={session.id} students={students} />
            ) : null}
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <EmptyState
                title="No students enrolled"
                description="This class has no active enrollments, so there is nothing to mark."
              />
            ) : (
              <ul className="divide-y divide-border">
                {students.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.fullName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{s.studentNumber}</p>
                    </div>
                    {s.record ? (
                      <div className="flex items-center gap-2">
                        {s.record.overrideReason ? (
                          <span className="text-xs text-muted-foreground" title={s.record.overrideReason}>
                            override
                          </span>
                        ) : null}
                        <Badge variant={STATUS_VARIANT[s.record.status] ?? "outline"}>{s.record.status}</Badge>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not marked
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
