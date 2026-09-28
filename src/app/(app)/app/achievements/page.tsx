import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listAchievements } from "@/server/services/activity.service";
import { listStudents } from "@/server/services/student.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateAchievementDialog } from "@/features/ops/components/activity-dialogs";

export const metadata: Metadata = { title: "Achievements" };

const levelVariant: Record<string, "neutral" | "info" | "success" | "warning" | "accent"> = {
  SCHOOL: "neutral",
  DISTRICT: "info",
  REGIONAL: "accent",
  NATIONAL: "success",
  INTERNATIONAL: "warning",
};

export default async function AchievementsPage() {
  const actor = await requirePageActor("achievement.read");
  const canManage = can(actor, "achievement.manage");
  const [achievements, students] = await Promise.all([
    listAchievements(actor),
    canManage ? listStudents(actor, { pageSize: 100 }) : Promise.resolve({ items: [] as { id: string; fullName: string; studentNumber: string }[] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achievements"
        description="Competition results and awards."
        breadcrumbs={[{ label: "Achievements" }]}
        actions={canManage ? <CreateAchievementDialog students={students.items.map((s) => ({ id: s.id, name: s.fullName, studentNumber: s.studentNumber }))} /> : null}
      />

      {achievements.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-6" aria-hidden />}
          title="No achievements recorded"
          description={canManage ? "Record a competition result to celebrate it here." : "No achievements have been recorded yet."}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {achievements.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <span className="font-medium">{a.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {[a.student ? `${a.student.fullName} (${a.student.studentNumber})` : "School", a.competition, a.rank].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={levelVariant[a.level] ?? "neutral"}>{a.level.toLowerCase()}</Badge>
                <span className="tabular text-sm text-muted-foreground">{a.achievedAt.toLocaleDateString()}</span>
                {a.student ? (
                  <Link href={`/app/students/${a.student.id}`} className="text-sm text-primary hover:underline underline-offset-4">
                    View
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
