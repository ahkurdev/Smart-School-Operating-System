#!/usr/bin/env bash
# SSOS database backup (pg_dump native, no Docker)
# Usage: bash scripts/backup-database.sh [output_dir]
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ssos}"
OUT_DIR="${1:-./backups}"
STAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$OUT_DIR/ssos_backup_$STAMP.sql"

mkdir -p "$OUT_DIR"

# Parse connection string (safe subset: user:pass@host:port/db)
CLEAN_URL=$(echo "$DB_URL" | sed 's|postgresql://||' | sed 's|?.*||')
DBUSER=$(echo "$CLEAN_URL" | cut -d: -f1)
DBPASS=$(echo "$CLEAN_URL" | cut -d: -f2 | cut -d@ -f1)
DBHOST=$(echo "$CLEAN_URL" | sed 's|.*@||' | cut -d: -f1)
DBPORT=$(echo "$CLEAN_URL" | sed 's|.*@||' | cut -d: -f2 | cut -d/ -f1)
DBNAME=$(echo "$CLEAN_URL" | sed 's|.*/||')

PGPASSWORD="$DBPASS" pg_dump -h "$DBHOST" -p "$DBPORT" -U "$DBUSER" -d "$DBNAME" --no-owner -F p -f "$OUT_FILE"

# Retention: keep last 14 backups
ls -1t "$OUT_DIR"/ssos_backup_*.sql 2>/dev/null | tail -n +15 | xargs -r rm --

echo "Backup OK: $OUT_FILE"
