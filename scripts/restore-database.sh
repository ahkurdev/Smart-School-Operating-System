#!/usr/bin/env bash
# SSOS restore from backup file
# Usage: bash scripts/restore-database.sh <backup.sql> [target_db]
set -euo pipefail

BACKUP="${1:?Usage: restore-database.sh <backup.sql> [target_db]}"
TARGET_DB="${2:-ssos}"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ssos}"

CLEAN_URL=$(echo "$DB_URL" | sed 's|postgresql://||' | sed 's|?.*||')
DBUSER=$(echo "$CLEAN_URL" | cut -d: -f1)
DBPASS=$(echo "$CLEAN_URL" | cut -d: -f2 | cut -d@ -f1)
DBHOST=$(echo "$CLEAN_URL" | sed 's|.*@||' | cut -d: -f1)
DBPORT=$(echo "$CLEAN_URL" | sed 's|.*@||' | cut -d: -f2 | cut -d/ -f1)

[ -f "$BACKUP" ] || { echo "Backup file not found: $BACKUP"; exit 1; }

PGPASSWORD="$DBPASS" psql -h "$DBHOST" -p "$DBPORT" -U "$DBUSER" -tc "SELECT 1 FROM pg_database WHERE datname='$TARGET_DB'" | grep -q 1 || \
  PGPASSWORD="$DBPASS" psql -h "$DBHOST" -p "$DBPORT" -U "$DBUSER" -c "CREATE DATABASE $TARGET_DB"

PGPASSWORD="$DBPASS" psql -h "$DBHOST" -p "$DBPORT" -U "$DBUSER" -d "$TARGET_DB" -f "$BACKUP"
echo "Restore OK: $BACKUP -> $TARGET_DB"
echo "Verify with: psql -d $TARGET_DB -c '\\dt'"
