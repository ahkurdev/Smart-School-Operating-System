import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Megaphone, Users, GraduationCap, School } from "lucide-react";
import { requireActor } from "@/server/auth/context";
import { getDashboardData } from "@/server/services/dashboard.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

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
