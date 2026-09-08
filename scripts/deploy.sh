#!/usr/bin/env bash
# SSOS deploy script (native, PM2, no Docker)
# Flow: pull -> install -> build -> migrate -> reload processes
set -euo pipefail

BRANCH="${1:-main}"
PM2_CONFIG="ecosystem.config.js"

echo "[1/6] git pull ($BRANCH)"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[2/6] pnpm install"
pnpm install --frozen-lockfile

echo "[3/6] build all"
pnpm build

echo "[4/6] prisma migrate deploy"
( cd apps/api && pnpm db:deploy )

echo "[5/6] pm2 reload"
if pm2 describe smart-school-api > /dev/null 2>&1; then
  pm2 reload $PM2_CONFIG --update-env
else
  pm2 start $PM2_CONFIG --update-env
fi

echo "[6/6] health check"
sleep 3
curl -fsS "${HEALTH_URL:-http://127.0.0.1:4100/health}" > /dev/null && echo "Deploy OK" || { echo "Health check FAILED"; pm2 logs smart-school-api --lines 20 --nostream; exit 1; }
