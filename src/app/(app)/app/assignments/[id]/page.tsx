import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/guards";
import { getAssignment, getMySubmission } from "@/server/services/assignment.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { AssignmentStatusControls, SubmitPanel, GradePanel } from "@/features/work/components/assignment-panels";

export const metadata: Metadata = { title: "Assignment" };

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor();
  const assignment = await getAssignment(actor, id).catch(() => null);
  if (!assignment) notFound();

  const canManage = can(actor, "assignment.manage");
  const isStudent = can(actor, "assignment.submit") && !canManage;
  const mySubmission = isStudent ? await getMySubmission(actor, assignment.id) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={assignment.title}
        description={`${assignment.classroom.name} · ${assignment.subject.name}`}
        breadcrumbs={[
          { label: "Academic" },
          { label: "Assignments", href: "/app/assignments" },
          { label: assignment.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={assignment.status === "PUBLISHED" ? "success" : "neutral"}>{assignment.status.toLowerCase()}</Badge>
            <AssignmentStatusControls id={assignment.id} status={assignment.status} canManage={canManage} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="font-medium">Instructions</h2>
          <div className="whitespace-pre-line rounded-xl border border-border p-4 text-sm leading-relaxed">
            {assignment.instructions || "No instructions provided."}
          </div>
          {assignment.attachmentFileId && (
            <a href={`/api/files/${assignment.attachmentFileId}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
              View attachment
            </a>
          )}
        </div>
        <dl className="space-y-2 rounded-xl border border-border p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Max score</dt>
            <dd className="tabular">{assignment.maxScore}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Due</dt>
            <dd className="tabular">{assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Resubmission</dt>
            <dd>{assignment.allowResubmission ? "Allowed" : "Not allowed"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Submissions</dt>
            <dd className="tabular">{assignment.submissions.length}</dd>
          </div>
        </dl>
      </div>

      {isStudent && <SubmitPanel assignmentId={assignment.id} existing={mySubmission ? { status: mySubmission.status, score: mySubmission.score } : null} />}

      {canManage && (
        <section className="space-y-3">
          <h2 className="font-medium">Submissions ({assignment.submissions.length})</h2>
          {assignment.submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="space-y-4 rounded-xl border border-border p-4">
              {assignment.submissions.map((s) => (
                <div key={s.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {s.student.fullName} <span className="font-mono text-xs text-muted-foreground">{s.student.studentNumber}</span>
                    </span>
                    <Badge variant={s.status === "GRADED" ? "success" : "info"}>{s.status.toLowerCase()}</Badge>
                  </div>
                  {s.content && <p className="whitespace-pre-line text-sm text-muted-foreground">{s.content}</p>}
                  {s.fileId && (
                    <a href={`/api/files/${s.fileId}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                      View submitted file
                    </a>
                  )}
                  <GradePanel submissionId={s.id} studentName={s.student.fullName} score={s.score} maxScore={assignment.maxScore} feedback={s.feedback} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
