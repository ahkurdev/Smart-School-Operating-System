import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { getLibraryItem, listLoans } from "@/server/services/library.service";
import { listStudents } from "@/server/services/student.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BorrowDialog } from "@/features/library/components/borrow-dialog";

export const metadata: Metadata = { title: "Library item" };

const copyStatusVariant: Record<string, "success" | "warning" | "neutral" | "destructive"> = {
  AVAILABLE: "success",
  ON_LOAN: "warning",
  RESERVED: "neutral",
  LOST: "destructive",
  DAMAGED: "destructive",
};

export default async function LibraryItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const actor = await requirePageActor("library.read");
  const { itemId } = await params;

  let item: Awaited<ReturnType<typeof getLibraryItem>>;
  try {
    item = await getLibraryItem(actor, itemId);
  } catch {
    notFound();
  }

  const canManage = can(actor, "library.manage");
  const [students, loans] = await Promise.all([
    canManage ? listStudents(actor, { pageSize: 100 }) : Promise.resolve({ items: [] as { id: string; fullName: string; studentNumber: string }[] }),
    canManage ? listLoans(actor) : Promise.resolve([]),
  ]);

  const itemLoans = loans.filter((l) => l.copy.item.id === item.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={[item.author, item.publisher, item.year ? String(item.year) : null].filter(Boolean).join(" · ") || "Library item"}
        breadcrumbs={[{ label: "Library", href: "/app/library" }, { label: item.title }]}
        actions={
          canManage ? (
            <BorrowDialog
              copies={item.copies.map((c) => ({ id: c.id, barcode: c.barcode, status: c.status }))}
              students={students.items.map((s) => ({ id: s.id, name: s.fullName, studentNumber: s.studentNumber }))}
            />
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Type" value={<Badge variant="outline">{item.type.toLowerCase()}</Badge>} />
            <Row label="Category" value={item.category} />
            <Row label="ISBN" value={item.isbn} />
            <Row label="Access" value={item.accessLevel} />
            {item.externalUrl ? (
              <a
                href={item.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
              >
                <ExternalLink className="size-4" aria-hidden /> Open resource
              </a>
            ) : null}
            {item.description ? <p className="text-muted-foreground">{item.description}</p> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Copies</CardTitle>
          </CardHeader>
          <CardContent>
            {item.copies.length === 0 ? (
              <EmptyState
                icon={<FileText className="size-6" aria-hidden />}
                title="No physical copies"
                description={item.type !== "PHYSICAL" ? "This is a digital resource; no copies are tracked." : "Add copies to enable lending."}
              />
            ) : (
              <ul className="divide-y divide-border">
                {item.copies.map((copy) => (
                  <li key={copy.id} className="flex items-center justify-between gap-4 py-3">
                    <span className="tabular text-sm">{copy.barcode}</span>
                    <div className="flex items-center gap-3">
                      {copy.location ? <span className="text-sm text-muted-foreground">{copy.location}</span> : null}
                      <Badge variant={copyStatusVariant[copy.status] ?? "neutral"}>{copy.status.toLowerCase().replace("_", " ")}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {canManage && itemLoans.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Loan history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {itemLoans.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 py-3">
                  <span>{l.student ? `${l.student.fullName} (${l.student.studentNumber})` : "Staff"}</span>
                  <span className="text-muted-foreground">
                    {l.borrowedAt.toLocaleDateString()} → {l.returnedAt ? l.returnedAt.toLocaleDateString() : "on loan"}
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
