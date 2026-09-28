import { prisma } from "@/server/db/client";
import type { Prisma } from "@prisma/client";

/**
 * Background jobs (Phase 91).
 *
 * A queue abstraction over the `BackgroundJob` table. The default `inline`
 * driver executes immediately in-process; the table also supports a worker
 * model (claim by status + runAt) so a separate process can drain it later
 * without changing call sites. Handlers are registered by name so a job row
 * stores only a name + JSON payload, never code.
 */

export type JobHandler = (payload: Record<string, unknown>, job: { id: string; tenantId: string | null }) => Promise<unknown>;

const handlers = new Map<string, JobHandler>();

export function registerJob(name: string, handler: JobHandler): void {
  handlers.set(name, handler);
}

export function hasHandler(name: string): boolean {
  return handlers.has(name);
}

export type EnqueueInput = {
  name: string;
  payload?: Record<string, unknown>;
  tenantId?: string | null;
  queue?: string;
  runAt?: Date;
  maxAttempts?: number;
};

/**
 * Enqueue a job. With the inline driver the handler runs now; on failure the job
 * row is marked FAILED and the error is swallowed (callers must not depend on
 * side-effects being synchronous in production - they should rely on the row).
 */
export async function enqueue(input: EnqueueInput): Promise<{ id: string }> {
  // Ensure the named handlers exist before executing inline.
  const { registerAllJobs } = await import("@/server/jobs");
  registerAllJobs();

  const job = await prisma.backgroundJob.create({
    data: {
      tenantId: input.tenantId ?? null,
      queue: input.queue ?? "default",
      name: input.name,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      runAt: input.runAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 3,
      status: "QUEUED",
    },
    select: { id: true },
  });

  const handler = handlers.get(input.name);
  if (handler) {
    // Inline execution (the only driver implemented now).
    await runJob(job.id).catch(() => {
      /* recorded in the row */
    });
  }
  return job;
}

/** Execute one persisted job by id. Safe to call from a worker loop. */
export async function runJob(jobId: string): Promise<void> {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "SUCCEEDED" || job.status === "CANCELLED") return;
  const handler = handlers.get(job.name);
  if (!handler) {
    await prisma.backgroundJob.update({ where: { id: jobId }, data: { status: "FAILED", lastError: `No handler for job "${job.name}".`, finishedAt: new Date() } });
    return;
  }

  await prisma.backgroundJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date(), attempts: job.attempts + 1 } });
  try {
    const result = await handler((job.payload ?? {}) as Record<string, unknown>, { id: job.id, tenantId: job.tenantId });
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: "SUCCEEDED", finishedAt: new Date(), result: (result ?? {}) as Prisma.InputJsonValue },
    });
  } catch (e) {
    const failed = job.attempts + 1 >= job.maxAttempts;
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: failed ? "FAILED" : "QUEUED",
        lastError: e instanceof Error ? e.message.slice(0, 500) : "unknown error",
        finishedAt: failed ? new Date() : null,
        runAt: failed ? job.runAt : new Date(Date.now() + Math.min(60, 2 ** (job.attempts + 1)) * 60 * 1000),
      },
    });
  }
}

/**
 * Drain due jobs (for a worker process). Returns how many were processed. Keeps
 * the query bounded so it never scans the whole table.
 */
export async function drainQueue(limit = 20): Promise<number> {
  const due = await prisma.backgroundJob.findMany({
    where: { status: "QUEUED", runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const j of due) await runJob(j.id);
  return due.length;
}
