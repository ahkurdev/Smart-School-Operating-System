import type { Metadata } from "next";
import Link from "next/link";
import { Library as LibraryIcon, BookMarked, AlertTriangle } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listLibraryItems, listLoans, getLibraryStats } from "@/server/services/library.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateLibraryItemDialog } from "@/features/library/components/create-library-item-dialog";
import { ReturnLoanButton } from "@/features/library/components/return-loan-button";

export const metadata: Metadata = { title: "Library" };

const typeLabel: Record<string, string> = { PHYSICAL: "Physical", EBOOK: "E-book", DOCUMENT: "Document", LINK: "External link" };

export default async function LibraryPage() {
  const actor = await requirePageActor("library.read");
  const canManage = can(actor, "library.manage");

  const [catalog, loans, stats] = await Promise.all([
    listLibraryItems(actor, { pageSize: 50 }),
    listLoans(actor, { status: "ACTIVE" }),
    getLibraryStats(actor),
  ]);

  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library"
        description="Catalog, copies, loans and reservations."
        breadcrumbs={[{ label: "Library" }]}
        actions={canManage ? <CreateLibraryItemDialog /> : null}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Titles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-2xl font-semibold">{stats.items}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Copies</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-2xl font-semibold">{stats.copies}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active loans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-2xl font-semibold">{stats.activeLoans}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-2xl font-semibold text-destructive">{stats.overdue}</p>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="loans">Active loans</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          {catalog.items.length === 0 ? (
            <EmptyState
              icon={<LibraryIcon className="size-6" aria-hidden />}
              title="No items yet"
              description={canManage ? "Add the first title to start the catalog." : "The librarian hasn't added any titles yet."}
            />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {catalog.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Link href={`/app/library/${item.id}`} className="font-medium hover:underline underline-offset-4">
                      {item.title}
                    </Link>
                    <span className="block text-sm text-muted-foreground">
                      {[item.author, item.year ? String(item.year) : null, item.category].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{typeLabel[item.type] ?? item.type}</Badge>
                    {item.type === "PHYSICAL" ? (
                      <span className="tabular text-sm text-muted-foreground">{item._count.copies} copies</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="loans" className="mt-4">
          {loans.length === 0 ? (
            <EmptyState
              icon={<BookMarked className="size-6" aria-hidden />}
              title="No active loans"
              description="Copies currently on loan will appear here with their due dates."
            />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {loans.map((loan) => {
                const overdue = loan.dueAt.getTime() < now;
                return (
                  <li key={loan.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <span className="font-medium">{loan.copy.item.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {loan.student ? `${loan.student.fullName} (${loan.student.studentNumber})` : "Staff member"} · {loan.copy.barcode}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {overdue ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="size-3" aria-hidden /> Overdue
                        </Badge>
                      ) : (
                        <span className="tabular text-sm text-muted-foreground">Due {loan.dueAt.toLocaleDateString()}</span>
                      )}
                      {canManage ? <ReturnLoanButton loanId={loan.id} overdue={overdue} /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
