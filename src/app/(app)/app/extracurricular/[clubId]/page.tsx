import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Users2 } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { getExtracurricular } from "@/server/services/activity.service";
import { listStudents } from "@/server/services/student.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddClubMemberDialog } from "@/features/ops/components/add-club-member-dialog";

export const metadata: Metadata = { title: "Extracurricular" };

export default async function ClubDetailPage({ params }: { params: Promise<{ clubId: string }> }) {
  const actor = await requirePageActor("extracurricular.read");
  const { clubId } = await params;
  const canManage = can(actor, "extracurricular.manage");

  let club: Awaited<ReturnType<typeof getExtracurricular>>;
  try {
    club = await getExtracurricular(actor, clubId);
  } catch {
    notFound();
  }

  const students = canManage ? await listStudents(actor, { pageSize: 100 }) : { items: [] as { id: string; fullName: string; studentNumber: string }[] };

  return (
    <div className="space-y-6">
      <PageHeader
        title={club.name}
        description={club.description || "Extracurricular activity"}
        breadcrumbs={[{ label: "Extracurricular", href: "/app/extracurricular" }, { label: club.name }]}
        actions={canManage ? <AddClubMemberDialog clubId={club.id} students={students.items.map((s) => ({ id: s.id, name: s.fullName, studentNumber: s.studentNumber }))} /> : null}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Schedule" value={club.schedule} />
            <Row label="Location" value={club.location} />
            <Row label="Capacity" value={club.capacity ? String(club.capacity) : null} />
            <Row label="Status" value={<Badge variant={club.isActive ? "success" : "neutral"}>{club.isActive ? "Active" : "Inactive"}</Badge>} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Members ({club.members.filter((m) => m.isActive).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {club.members.filter((m) => m.isActive).length === 0 ? (
              <EmptyState icon={<Users2 className="size-6" aria-hidden />} title="No members" description={canManage ? "Add students to this activity." : "No students have joined yet."} />
            ) : (
              <ul className="divide-y divide-border">
                {club.members
                  .filter((m) => m.isActive)
                  .map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span className="font-medium">{m.student.fullName}</span>
                      <span className="text-muted-foreground">
                        {m.student.studentNumber}
                        {m.role ? ` · ${m.role}` : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {club.achievements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {club.achievements.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="font-medium">{a.title}</span>
                  <span className="text-muted-foreground">
                    {a.level.toLowerCase()} · {a.achievedAt.toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
