import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listSubjects, listDepartments } from "@/server/services/academic.service";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { AddSubjectDialog, AddDepartmentDialog, EditSubjectDialog } from "@/features/academics/components/subject-forms";

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const actor = await requirePageActor("subject.read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const [result, departments] = await Promise.all([
    listSubjects(actor, { search: sp.q, page, pageSize: 20 }),
    listDepartments(actor).catch(() => []),
  ]);
  const deptOptions = departments.map((d) => ({ id: d.id, name: d.name }));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Subjects"
        description="Subjects taught at this school, grouped by department."
        actions={
          can(actor, "subject.manage") ? (
            <div className="flex gap-2">
              <AddDepartmentDialog />
              <AddSubjectDialog departments={deptOptions} />
            </div>
          ) : null
        }
      />

      <form className="flex items-end gap-2" action="/app/subjects" method="get">
        <div className="max-w-xs flex-1">
          <label htmlFor="q" className="sr-only">
            Search subjects
          </label>
          <Input id="q" name="q" placeholder="Search subjects" defaultValue={sp.q ?? ""} />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No subjects yet"
          description="Add subjects so teachers can create assignments and assessments."
        />
      ) : (
        <>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Status</TableHead>
                  {can(actor, "subject.manage") ? <TableHead className="w-10" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="tabular font-medium">{s.code}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.department?.name ?? "-"}</TableCell>
                    <TableCell className="tabular text-right">{s.credits}</TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? "success" : "outline"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    {can(actor, "subject.manage") ? (
                      <TableCell>
                        <EditSubjectDialog
                          values={{
                            id: s.id,
                            code: s.code,
                            name: s.name,
                            credits: s.credits,
                            departmentId: s.department?.id ?? "",
                            description: "",
                            learningObjectives: "",
                            isActive: s.isActive,
                          }}
                          departments={deptOptions}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/app/subjects"
            params={{ q: sp.q }}
            noun="subject"
          />
        </>
      )}
    </div>
  );
}
