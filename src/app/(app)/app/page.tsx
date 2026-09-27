import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Megaphone, Users, GraduationCap, School, BookOpen, UserCheck } from "lucide-react";
import { requireActor } from "@/server/auth/context";
import { getDashboardData } from "@/server/services/dashboard.service";
import { getLandingDashboard } from "@/server/services/role-dashboard.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * A "my day" panel for staff/students/parents (Phases 56-58). It sits above the
 * school-wide admin cards so a teacher lands on their own timetable, a student
 * on theirs, and a parent on their children — all from live data.
 */
async function RolePanel() {
  const actor = await requireActor();
  const landing = await getLandingDashboard(actor);

  if (landing.kind === "teacher" && landing.data) {
    const d = landing.data;
    return (
      <section className="space-y-4" aria-labelledby="my-day">
        <h2 id="my-day" className="font-display text-lg font-semibold">
          My day · {d.teacherName}
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today&apos;s classes</CardTitle>
              <CardDescription>{d.todayClasses.length} scheduled for {new Date().toLocaleDateString(undefined, { weekday: "long" })}</CardDescription>
            </CardHeader>
            <CardContent>
              {d.todayClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes scheduled today.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {d.todayClasses.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.subject}</p>
                        <p className="text-xs text-muted-foreground">{c.classroom}</p>
                      </div>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {c.startTime}–{c.endTime}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance to take</CardTitle>
              <CardDescription>Sessions awaiting a scan</CardDescription>
            </CardHeader>
            <CardContent>
              {d.sessionsToTake.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing to take right now.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {d.sessionsToTake.map((s) => (
                    <li key={s.id}>
                      <Link href={`/app/attendance/${s.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-primary">
                        <span className="text-sm">
                          {s.classroom}
                          {s.subject ? ` · ${s.subject}` : ""}
                        </span>
                        <Badge variant={s.status === "OPEN" ? "success" : "neutral"}>{s.status.toLowerCase()}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  if (landing.kind === "student" && landing.data) {
    const d = landing.data;
    return (
      <section className="space-y-4" aria-labelledby="my-day">
        <h2 id="my-day" className="font-display text-lg font-semibold">
          My day · {d.studentName}
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today&apos;s timetable</CardTitle>
              <CardDescription>{d.className ?? "No class assigned"}</CardDescription>
            </CardHeader>
            <CardContent>
              {d.todayClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes today.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {d.todayClasses.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.subject}</p>
                        <p className="text-xs text-muted-foreground">{c.teacher ?? "—"}{c.room ? ` · ${c.room}` : ""}</p>
                      </div>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {c.startTime}–{c.endTime}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">My attendance</CardTitle>
                <CardDescription>All-time</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="tabular text-2xl font-semibold">{d.attendance.rate != null ? `${d.attendance.rate}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Present</p>
                  <p className="tabular text-xl font-semibold text-success">{d.attendance.present}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Absent</p>
                  <p className="tabular text-xl font-semibold text-destructive">{d.attendance.absent}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming work</CardTitle>
              </CardHeader>
              <CardContent>
                {d.upcomingWork.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing due.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {d.upcomingWork.map((w) => (
                      <li key={w.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="truncate text-sm">{w.title}</span>
                        <span className="tabular shrink-0 text-xs text-muted-foreground">
                          {w.dueAt ? new Date(w.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "no due date"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    );
  }

  if (landing.kind === "parent" && landing.data) {
    return (
      <section className="space-y-4" aria-labelledby="my-day">
        <h2 id="my-day" className="font-display text-lg font-semibold">My children</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {landing.data.children.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.name}</CardTitle>
                <CardDescription>
                  {c.studentNumber}
                  {c.className ? ` · ${c.className}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="size-4 text-muted-foreground" aria-hidden />
                  Attendance: <span className="tabular font-medium">{c.attendanceRate != null ? `${c.attendanceRate}%` : "—"}</span>
                </div>
                {c.recentGrade && (
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="size-4 text-muted-foreground" aria-hidden />
                    <span className="truncate">{c.recentGrade.title}:</span>
                    <span className="tabular font-medium">
                      {c.recentGrade.score ?? "—"}
                      {c.recentGrade.maxScore ? `/${c.recentGrade.maxScore}` : ""}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }
  return null;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="tabular text-2xl font-semibold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const actor = await requireActor();
  const data = await getDashboardData(actor);

  const attendance = data.attendanceToday;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="ruled">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Today&apos;s picture across the school. Figures reflect live data.
        </p>
      </header>

      <RolePanel />

      <section aria-labelledby="counts-heading">
        <h2 id="counts-heading" className="sr-only">
          School totals
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Students" value={data.counts.students} icon={Users} hint="Active enrolments" />
          <StatCard label="Teachers" value={data.counts.teachers} icon={GraduationCap} hint="Active records" />
          <StatCard label="Classes" value={data.counts.classes} icon={School} hint="Across campus" />
          <StatCard
            label="Attendance today"
            value={attendance?.rate != null ? `${attendance.rate}%` : "-"}
            icon={CalendarDays}
            hint={
              attendance && attendance.total > 0
                ? `${attendance.present + attendance.late} of ${attendance.total} marked`
                : "No attendance recorded yet today"
            }
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance today</CardTitle>
            <CardDescription>Records placed so far today.</CardDescription>
          </CardHeader>
          <CardContent>
            {attendance && attendance.total > 0 ? (
              <dl className="grid grid-cols-3 gap-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Present</dt>
                  <dd className="tabular text-xl font-semibold text-success">{attendance.present}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Late</dt>
                  <dd className="tabular text-xl font-semibold text-warning">{attendance.late}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Absent</dt>
                  <dd className="tabular text-xl font-semibold text-destructive">{attendance.absent}</dd>
                </div>
              </dl>
            ) : (
              <EmptyState
                title="No attendance yet today"
                description="Once a teacher opens a session and scans, today's numbers appear here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming events</CardTitle>
            <CardDescription>Next published events on the school calendar.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingEvents.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.upcomingEvents.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      {e.location ? (
                        <p className="truncate text-xs text-muted-foreground">{e.location}</p>
                      ) : null}
                    </div>
                    <time
                      className="tabular shrink-0 text-xs text-muted-foreground"
                      dateTime={e.startAt.toISOString()}
                    >
                      {e.startAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No upcoming events"
                description="Published events from the calendar will be listed here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Latest announcements</CardTitle>
              <CardDescription>Recently published notices.</CardDescription>
            </div>
            <Megaphone className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            {data.announcements.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.announcements.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <p className="truncate text-sm">{a.title}</p>
                    {a.publishAt ? (
                      <time
                        className="tabular shrink-0 text-xs text-muted-foreground"
                        dateTime={a.publishAt.toISOString()}
                      >
                        {a.publishAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </time>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No announcements yet"
                description="Published announcements will show here."
              />
            )}
          </CardContent>
        </Card>

        {data.admissions ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admissions</CardTitle>
              <CardDescription>Applications awaiting attention.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Awaiting verification</p>
                <p className="tabular text-2xl font-semibold">{data.admissions.pendingVerification}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">In progress</p>
                <p className="tabular text-2xl font-semibold">{data.admissions.submitted}</p>
              </div>
              <Link
                href="/app/admissions"
                className="ml-auto text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Review
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {actor.isPlatform ? <Badge variant="info">Platform admin</Badge> : null}
        {actor.roleKeys.slice(0, 4).map((r) => (
          <Badge key={r} variant="outline" className="capitalize">
            {r.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
    </div>
  );
}
