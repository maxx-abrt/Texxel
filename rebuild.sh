#!/bin/bash
# Rebuild the Next.js production bundle and restart the supervisor frontend.
set -e
cd /app/frontend
echo "[flux] building..."
yarn build 2>&1 | tail -20
echo "[flux] restarting frontend..."
supervisorctl restart frontend >/dev/null 2>&1
sleep 6
curl -s -o /dev/null -w "[flux] / -> HTTP %{http_code}\n" http://localhost:3000/
echo "[flux] done."
