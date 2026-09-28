import { registerAllJobs } from "@/server/jobs/handlers";

/**
 * Server-side job bootstrap. Import this once from any server entry point that
 * may enqueue jobs (server actions, route handlers, seed) so the named handlers
 * are available before a job runs inline.
 */
registerAllJobs();

export { registerAllJobs };
