import { prisma } from "@/server/db/client";
import { can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import type { Actor } from "@/types/actor";

/**
 * Permission-aware global search. Only resource types the actor may read are
 * queried at all (not merely filtered afterwards), so a low-privilege user can
 * never learn that a record exists via search. Results are capped per type; the
 * command palette renders them as navigation targets.
 */

export type SearchHit = {
  type: "student" | "teacher" | "class" | "subject" | "guardian" | "applicant" | "page" | "user";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const PER_TYPE_LIMIT = 6;

export async function globalSearch(actor: Actor, query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const tenantId = requireTenantId(actor);
  const like = { contains: q, mode: "insensitive" as const };

  const tasks: Promise<SearchHit[]>[] = [];

  if (can(actor, "student.read")) {
    tasks.push(
      prisma.student
        .findMany({
          where: { tenantId, deletedAt: null, OR: [{ fullName: like }, { studentNumber: like }] },
          select: { id: true, fullName: true, studentNumber: true },
          take: PER_TYPE_LIMIT,
          orderBy: { fullName: "asc" },
        })
        .then((rows) =>
          rows.map((s) => ({
            type: "student" as const,
            id: s.id,
            title: s.fullName,
            subtitle: s.studentNumber,
            href: `/app/students/${s.id}`,
          })),
        ),
    );
  }

  if (can(actor, "teacher.read")) {
    tasks.push(
      prisma.teacher
        .findMany({
          where: { tenantId, deletedAt: null, OR: [{ fullName: like }, { employeeNumber: like }] },
          select: { id: true, fullName: true, employeeNumber: true },
          take: PER_TYPE_LIMIT,
          orderBy: { fullName: "asc" },
        })
        .then((rows) =>
          rows.map((t) => ({
            type: "teacher" as const,
            id: t.id,
            title: t.fullName,
            subtitle: t.employeeNumber,
            href: `/app/teachers/${t.id}`,
          })),
        ),
    );
  }

  if (can(actor, "class.read")) {
    tasks.push(
      prisma.classroom
        .findMany({
          where: { tenantId, deletedAt: null, OR: [{ name: like }, { code: like }] },
          select: { id: true, name: true, code: true },
          take: PER_TYPE_LIMIT,
          orderBy: { name: "asc" },
        })
        .then((rows) =>
          rows.map((c) => ({
            type: "class" as const,
            id: c.id,
            title: c.name,
            subtitle: c.code,
            href: `/app/classes/${c.id}`,
          })),
        ),
    );
  }

  if (can(actor, "subject.read")) {
    tasks.push(
      prisma.subject
        .findMany({
          where: { tenantId, OR: [{ name: like }, { code: like }] },
          select: { id: true, name: true, code: true },
          take: PER_TYPE_LIMIT,
          orderBy: { name: "asc" },
        })
        .then((rows) =>
          rows.map((s) => ({
            type: "subject" as const,
            id: s.id,
            title: s.name,
            subtitle: s.code,
            href: `/app/subjects`,
          })),
        ),
    );
  }

  if (can(actor, "guardian.read")) {
    tasks.push(
      prisma.guardian
        .findMany({
          where: { tenantId, deletedAt: null, fullName: like },
          select: { id: true, fullName: true, relationship: true },
          take: PER_TYPE_LIMIT,
          orderBy: { fullName: "asc" },
        })
        .then((rows) =>
          rows.map((g) => ({
            type: "guardian" as const,
            id: g.id,
            title: g.fullName,
            subtitle: g.relationship,
            href: `/app/guardians/${g.id}`,
          })),
        ),
    );
  }

  if (can(actor, "user.read")) {
    tasks.push(
      prisma.membership
        .findMany({
          where: {
            tenantId,
            user: { OR: [{ fullName: like }, { email: like }] },
          },
          select: { id: true, user: { select: { fullName: true, email: true } } },
          take: PER_TYPE_LIMIT,
        })
        .then((rows) =>
          rows.map((m) => ({
            type: "user" as const,
            id: m.id,
            title: m.user.fullName ?? m.user.email ?? "User",
            subtitle: m.user.email ?? undefined,
            href: `/app/users/${m.id}`,
          })),
        ),
    );
  }

  const groups = await Promise.all(tasks);
  return groups.flat();
}
