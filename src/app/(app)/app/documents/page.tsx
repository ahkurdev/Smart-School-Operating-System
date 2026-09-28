import type { Metadata } from "next";
import { FileLock2, Download } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listDocuments } from "@/server/services/document.service";
import { listStudents } from "@/server/services/student.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UploadDocumentDialog } from "@/features/ops/components/upload-document-dialog";

export const metadata: Metadata = { title: "Documents" };

const accessVariant: Record<string, "success" | "info" | "warning" | "neutral"> = {
  PUBLIC: "success",
  STAFF: "info",
  RESTRICTED: "warning",
  PRIVATE: "neutral",
};

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const actor = await requirePageActor("document.read");
  const canManage = can(actor, "document.manage");
  const [docs, students] = await Promise.all([
    listDocuments(actor),
    canManage ? listStudents(actor, { pageSize: 100 }) : Promise.resolve({ items: [] as { id: string; fullName: string; studentNumber: string }[] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Secure documents with access controls and expiry."
        breadcrumbs={[{ label: "Documents" }]}
        actions={canManage ? <UploadDocumentDialog students={students.items.map((s) => ({ id: s.id, name: s.fullName, studentNumber: s.studentNumber }))} /> : null}
      />

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileLock2 className="size-6" aria-hidden />}
          title="No documents"
          description={canManage ? "Upload a document to store it securely." : "No documents are available to you."}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <span className="font-medium">{d.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {[d.category, d.student ? `${d.student.fullName} (${d.student.studentNumber})` : null, d.file ? humanSize(d.file.size) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={accessVariant[d.accessLevel] ?? "neutral"}>{d.accessLevel.toLowerCase()}</Badge>
                <a
                  href={`/api/files/${d.file.id}`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline underline-offset-4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="size-4" aria-hidden /> Open
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
