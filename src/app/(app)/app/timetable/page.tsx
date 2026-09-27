import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/guards";
import { listAcademicYears, listClasses, listSubjects } from "@/server/services/academic.service";
import { getTimetable } from "@/server/services/timetable.service";
import { prisma } from "@/server/db/client";
import { requireTenantId } from "@/server/db/tenant";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarClock } from "lucide-react";
import { AddEntryForm, DeleteEntryButton } from "@/features/timetable/components/timetable-controls";

export const metadata: Metadata = { title: "Timetable" };

const DAYS = [
  { n: 1, label: "Monday" },
  { n: 2, label: "Tuesday" },
  { n: 3, label: "Wednesday" },
  { n: 4, label: "Thursday" },
  { n: 5, label: "Friday" },
  { n: 6, label: "Saturday" },
];

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const actor = await requirePageActor();
  const tenantId = requireTenantId(actor);
  const { class: classParam } = await searchParams;

  const years = await listAcademicYears(actor);
  const current = years.find((y) => y.isCurrent) ?? years[0];

  if (!current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Timetable" description="Class and teacher scheduling with collision detection." />
        <EmptyState icon={<CalendarClock className="size-6" aria-hidden />} title="No academic year" description="Create an academic year before building a timetable." />
      </div>
    );
  }

  const classes = await listClasses(actor, { academicYearId: current.id });
  const selectedClassId = classParam ?? classes[0]?.id;
  const [subjects, teachers, rooms, entries] = await Promise.all([
    listSubjects(actor, { pageSize: 100 }),
    prisma.teacher.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, user: { select: { fullName: true } } }, take: 200 }),
    prisma.room.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, take: 200 }),
    selectedClassId
      ? getTimetable(actor, { academicYearId: current.id, classroomId: selectedClassId })
      : Promise.resolve([]),
  ]);

  const byDay = new Map<number, typeof entries>();
  for (const e of entries) {
    if (!byDay.has(e.dayOfWeek)) byDay.set(e.dayOfWeek, []);
    byDay.get(e.dayOfWeek)!.push(e);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        description={`Weekly schedule · ${current.name}`}
        breadcrumbs={[{ label: "Academic" }, { label: "Timetable" }]}
      />

      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/app/timetable?class=${c.id}`}
            className={
              "rounded-full border px-3 py-1 text-sm " +
              (c.id === selectedClassId ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")
            }
          >
            {c.name}
          </Link>
        ))}
      </div>

      {can(actor, "timetable.manage") && selectedClassId && (
        <AddEntryForm
          academicYearId={current.id}
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          subjects={subjects.items.map((s) => ({ id: s.id, name: s.name }))}
          teachers={teachers.map((t) => ({ id: t.id, name: t.user?.fullName ?? "(unnamed)" }))}
          rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
        />
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-6" aria-hidden />}
          title="No scheduled slots"
          description={selectedClassId ? "Add slots above to build this class's weekly timetable." : "Select a class to view its timetable."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {DAYS.map((day) => {
            const dayEntries = byDay.get(day.n) ?? [];
            return (
              <div key={day.n} className="rounded-xl border border-border">
                <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">{day.label}</div>
                <ul className="divide-y divide-border">
                  {dayEntries.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-muted-foreground">—</li>
                  ) : (
                    dayEntries.map((e) => (
                      <li key={e.id} className="space-y-1 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium tabular-nums">
                            {e.startTime}–{e.endTime}
                          </span>
                          {can(actor, "timetable.manage") && <DeleteEntryButton id={e.id} />}
                        </div>
                        <div className="text-sm">{e.subject.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.teacher?.user?.fullName ?? "Unassigned"}
                          {e.room ? ` · ${e.room.name}` : ""}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
