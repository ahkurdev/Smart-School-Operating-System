"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { unlinkStudentAction, updateLinkAction } from "@/features/guardians/actions";

export type LinkedStudent = {
  id: string;
  fullName: string;
  studentNumber: string;
  status: string;
  relationship: string;
  isPrimary: boolean;
  canPickup: boolean;
  hasPortalAccess: boolean;
};

/**
 * Linked-students list with per-link actions. Unlink is destructive; primary
 * toggling re-uses the same transactional demote-others logic on the server.
 */
export function LinkedStudentsList({
  guardianId,
  links,
  canLink,
}: {
  guardianId: string;
  links: LinkedStudent[];
  canLink: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function unlink(studentId: string, name: string) {
    startTransition(async () => {
      const res = await unlinkStudentAction(guardianId, studentId);
      if (res.ok) toast.success(`${name} unlinked.`);
      else toast.error(res.message);
    });
  }

  function makePrimary(studentId: string) {
    startTransition(async () => {
      const res = await updateLinkAction(guardianId, studentId, { isPrimary: true });
      if (res.ok) toast.success(res.message ?? "Updated");
      else toast.error(res.message);
    });
  }

  return (
    <ul className="divide-y divide-border text-sm">
      {links.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="font-medium">
              <Link
                href={`/app/students/${s.id}`}
                className="underline-offset-4 hover:underline"
              >
                {s.fullName}
              </Link>{" "}
              {s.isPrimary ? <Badge variant="success">Primary</Badge> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="tabular">{s.studentNumber}</span> · {s.relationship}
              {s.canPickup ? " · can pick up" : ""}
              {s.hasPortalAccess ? " · portal access" : " · no portal access"}
            </p>
          </div>
          {canLink ? (
            <div className="flex items-center gap-1.5">
              {!s.isPrimary ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => makePrimary(s.id)}
                  disabled={pending}
                >
                  Make primary
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => unlink(s.id, s.fullName)}
                disabled={pending}
              >
                <Unlink className="size-4" aria-hidden /> Unlink
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
