#!/usr/bin/env bash
# Dev PostgreSQL control script (uses the project-local portable PostgreSQL in .pgsql/)
# This is for LOCAL DEVELOPMENT ONLY. In production, point DATABASE_URL at any
# standard PostgreSQL provider (Neon, RDS, Cloud SQL, self-hosted, etc.).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# pg_ctl.exe / initdb.exe are native Windows binaries and need Windows-style paths.
ROOT_W="$(cd "$ROOT" && pwd -W)"
PGBIN="$ROOT_W/.pgsql/bin"
PGDATA="$ROOT_W/.pgdata"
PORT="${PGPORT:-5433}"
LOG="$PGDATA/postgres.log"

case "${1:-}" in
  start)
    if "$PGBIN/psql.exe" -h 127.0.0.1 -p "$PORT" -U postgres -tAc "SELECT 1" >/dev/null 2>&1; then
      echo "postgres already running on port $PORT"
      exit 0
    fi
    rm -f "$ROOT/.pgdata/postmaster.pid"
    # On some Windows hosts, pg_ctl's job-object wrapper makes backend child
    # processes fail with exception 0xC0000142. Launching postgres directly is
    # reliable; poll the port for readiness instead of relying on pg_ctl -w.
    nohup "$PGBIN/postgres.exe" -D "$PGDATA" -p "$PORT" >> "$LOG" 2>&1 &
    for _ in $(seq 1 30); do
      if "$PGBIN/psql.exe" -h 127.0.0.1 -p "$PORT" -U postgres -tAc "SELECT 1" >/dev/null 2>&1; then
        echo "postgres started on port $PORT"; exit 0
      fi
      sleep 1
    done
    echo "postgres failed to start; see .pgdata/postgres.log" >&2
    tail -20 "$LOG" >&2 || true
    exit 1
    ;;
  stop)
    "$PGBIN/pg_ctl.exe" -D "$PGDATA" -m fast -w stop 2>/dev/null || true
    rm -f "$ROOT/.pgdata/postmaster.pid"
    echo "postgres stopped"
    ;;
  status)
    if "$PGBIN/psql.exe" -h 127.0.0.1 -p "$PORT" -U postgres -tAc "SELECT 1" >/dev/null 2>&1; then
      echo "postgres is running on port $PORT"
    else
      echo "postgres is not running"; exit 1
    fi
    ;;
  psql)
    shift
    "$PGBIN/psql.exe" -h 127.0.0.1 -p "$PORT" -U postgres "$@"
    ;;
  *)
    echo "usage: $0 {start|stop|status|psql}"
    exit 1
    ;;
esac
