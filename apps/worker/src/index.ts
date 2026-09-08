/**
 * SSOS background worker.
 * Phase 1: minimal standalone process with graceful shutdown.
 * Queue backend (Redis/BullMQ) will be plugged in behind this loop when
 * notification/report/AI jobs land. Until then it idles on an interval.
 */
import { logger, env } from './shared'

const log = logger.child({ proc: 'worker' })
const INTERVAL_MS = Number(env('WORKER_INTERVAL_MS', '10000'))

let running = true

async function tick(): Promise<void> {
  log.debug({ at: new Date().toISOString() }, 'worker tick')
}

async function main(): Promise<void> {
  log.info({ intervalMs: INTERVAL_MS }, 'SSOS worker started')
  while (running) {
    try {
      await tick()
    } catch (err) {
      log.error({ err }, 'worker tick failed')
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS))
  }
}

function shutdown(signal: string): void {
  log.info({ signal }, 'worker shutting down')
  running = false
  setTimeout(() => process.exit(0), 2000)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

main().catch((err) => {
  log.fatal({ err }, 'worker fatal')
  process.exit(1)
})
