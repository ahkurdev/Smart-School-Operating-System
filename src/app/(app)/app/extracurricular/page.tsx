import type { Metadata } from "next";
import Link from "next/link";
import { Users2 } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listExtracurriculars } from "@/server/services/activity.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateExtracurricularDialog } from "@/features/ops/components/activity-dialogs";

export const metadata: Metadata = { title: "Extracurricular" };

export default async function ExtracurricularPage() {
  const actor = await requirePageActor("extracurricular.read");
  const canManage = can(actor, "extracurricular.manage");
  const clubs = await listExtracurriculars(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extracurricular"
        description="Clubs, activities, and their members."
        breadcrumbs={[{ label: "Extracurricular" }]}
        actions={canManage ? <CreateExtracurricularDialog /> : null}
      />

      {clubs.length === 0 ? (
        <EmptyState
          icon={<Users2 className="size-6" aria-hidden />}
          title="No activities yet"
          description={canManage ? "Add a club to start enrolling members." : "No extracurricular activities have been added yet."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <li key={c.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/app/extracurricular/${c.id}`} className="font-medium hover:underline underline-offset-4">
                  {c.name}
                </Link>
                <Badge variant={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description || "No description."}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {c._count.members} member{c._count.members === 1 ? "" : "s"}
                {c.schedule ? ` · ${c.schedule}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
