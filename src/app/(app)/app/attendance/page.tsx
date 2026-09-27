import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listSessions, getAttendanceOverview } from "@/server/services/attendance.service";
import { listClasses, listSubjects, listAcademicYears } from "@/server/services/academic.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreateSessionDialog } from "@/features/attendance/components/create-session-dialog";

export const metadata: Metadata = { title: "Attendance" };

const STATUS_VARIANT: Record<string, "outline" | "success" | "info" | "warning" | "destructive"> = {
  SCHEDULED: "outline",
  OPEN: "success",
  CLOSED: "info",
  CANCELLED: "destructive",
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const actor = await requirePageActor("attendance.read");
  const sp = await searchParams;
  const date = sp.date ? new Date(sp.date) : new Date();

  const [sessions, overview, classes, subjects, years] = await Promise.all([
    listSessions(actor, { date }),
    getAttendanceOverview(actor, date),
    can(actor, "class.read") ? listClasses(actor) : Promise.resolve([]),
    can(actor, "subject.read") ? listSubjects(actor, { pageSize: 100 }) : Promise.resolve({ items: [] }),
    can(actor, "academic.read") ? listAcademicYears(actor).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Attendance"
        description="Sessions for the day, their status, and how much of the roster is recorded."
        actions={
          can(actor, "attendance.manage") ? (
            <CreateSessionDialog
              classrooms={classes.map((c) => ({ id: c.id, name: c.name }))}
              subjects={subjects.items.map((s) => ({ id: s.id, name: s.name }))}
              academicYears={years.map((y) => ({ id: y.id, name: y.name }))}
            />
          ) : null
        }
      />

      <form className="flex items-end gap-2" action="/app/attendance" method="get">
        <div>
          <label htmlFor="date" className="mb-1 block text-xs text-muted-foreground">
            Date
          </label>
          <Input id="date" name="date" type="date" defaultValue={date.toISOString().slice(0, 10)} className="w-44" />
        </div>
        <Button type="submit" variant="outline" size="sm">
          View
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sessions today</p>
            <p className="tabular text-2xl font-semibold">{overview.sessionsToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Open now</p>
            <p className="tabular text-2xl font-semibold">{overview.openSessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Attendance rate</p>
            <p className="tabular text-2xl font-semibold">
              {overview.attendanceRate === null ? "—" : `${overview.attendanceRate}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck />}
          title="No sessions on this day"
          description={
            can(actor, "attendance.manage")
              ? "Create a session to start taking attendance."
              : "No attendance sessions have been created for this date."
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/app/attendance/${s.id}`} className="font-medium hover:underline">
                      {s.title ?? s.classroom?.name ?? "Session"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {s.classroom?.name ?? "No class"}
                      {s.subject ? ` · ${s.subject.name}` : ""} ·{" "}
                      {new Date(s.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–
                      {new Date(s.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular text-xs text-muted-foreground">{s._count.records} marked</span>
                    <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>{s.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
