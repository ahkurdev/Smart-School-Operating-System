import type { Actor } from "@/types/actor";
import { prisma } from "@/server/db/client";
import { requireTenantId } from "@/server/db/tenant";
import type { AiContext } from "@/server/ai/assistant.service";

/**
 * Resolve which assistant "persona" an actor should get, from their real role in
 * the tenant - never from anything the client sends. A platform/admin actor gets
 * the admin assistant; a teacher gets the teaching assistant; a linked student
 * gets the student assistant; a linked guardian gets the family assistant.
 */
export async function resolveAiContext(actor: Actor): Promise<AiContext> {
  if (actor.isPlatform || actor.permissions.has("student.read") || actor.permissions.has("reporting.read")) {
    return "admin";
  }
  const tenantId = requireTenantId(actor);
  const [teacher, student, guardian] = await Promise.all([
    prisma.teacher.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } }),
    prisma.student.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } }),
    prisma.guardian.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } }),
  ]);
  if (teacher) return "teacher";
  if (student) return "student";
  if (guardian) return "parent";
  return "admin";
}
