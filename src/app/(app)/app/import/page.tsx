import type { Metadata } from "next";
import { Upload } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentImport } from "@/features/ops/components/student-import";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  const actor = await requirePageActor("student.import");
  const canImport = can(actor, "student.import");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import data"
        description="Bulk-load records from a CSV file. Nothing is written until you confirm the preview."
        breadcrumbs={[{ label: "Import" }]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          {canImport ? (
            <StudentImport />
          ) : (
            <EmptyState
              icon={<Upload className="size-6" aria-hidden />}
              title="Import not available"
              description="You do not hold the student.import permission."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
