import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listMaterials } from "@/server/services/assignment.service";
import { listSubjects } from "@/server/services/academic.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateMaterialDialog } from "@/features/work/components/create-material-dialog";
import { MaterialControls } from "@/features/work/components/material-controls";

export const metadata: Metadata = { title: "Materials" };

export default async function MaterialsPage() {
  const actor = await requirePageActor();
  const canManage = can(actor, "material.manage");
  const [materials, subjects] = await Promise.all([listMaterials(actor), canManage ? listSubjects(actor, { pageSize: 100 }) : Promise.resolve({ items: [] })]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning materials"
        description={canManage ? "Documents, links and notes for your subjects." : "Materials shared with your class."}
        breadcrumbs={[{ label: "Academic" }, { label: "Materials" }]}
        actions={canManage && subjects.items.length ? <CreateMaterialDialog subjects={subjects.items.map((s) => ({ id: s.id, name: s.name }))} /> : null}
      />
      {materials.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-6" aria-hidden />} title="No materials yet" description="Add a document, link or note for a subject." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.title}</span>
                  <Badge variant={m.status === "PUBLISHED" ? "success" : "neutral"}>{m.status.toLowerCase()}</Badge>
                </div>
                <span className="block text-sm text-muted-foreground">
                  {m.subject.name} · {m.type.toLowerCase()}
                  {m.unit ? ` · ${m.unit}` : ""}
                  {m.topic ? ` / ${m.topic}` : ""}
                </span>
                {m.url && (
                  <a href={m.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                    Open link
                  </a>
                )}
              </div>
              <MaterialControls id={m.id} status={m.status} canManage={canManage} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
