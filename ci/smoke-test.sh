#!/usr/bin/env bash
# -------------------------------------------------------
# Starts the real server against Postgres and checks that
# the main routes answer the way they should.
#
# Locally (from the repo root):   bash ci/smoke-test.sh
#   Starts a throwaway Postgres in Docker on port 5433 and
#   removes it afterwards. Docker must be running.
#
# In CI: DATABASE_URL is already set to the Postgres service,
#   so no container is started.
# -------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/../app"

PORT="${SMOKE_PORT:-3999}"
BASE="http://127.0.0.1:$PORT"
DB_CONTAINER=stream-ticker-smoke-db
SERVER_LOG="$(mktemp)"
SERVER_PID=""

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  if [ "${STARTED_DB:-0}" = 1 ]; then docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true; fi
  rm -f "$SERVER_LOG"
}
trap cleanup EXIT

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Starting throwaway Postgres container..."
  docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$DB_CONTAINER" -p 5433:5432 \
    -e POSTGRES_USER=ticker -e POSTGRES_PASSWORD=ticker -e POSTGRES_DB=stream_ticker \
    postgres:16-alpine >/dev/null
  STARTED_DB=1
  export DATABASE_URL=postgresql://ticker:ticker@127.0.0.1:5433/stream_ticker
fi

# Dummy values: nothing here talks to the real Twitch.
export NODE_ENV=test PORT APP_URL="$BASE" SESSION_SECRET=smoke ENCRYPTION_KEY="$(printf '0%.0s' $(seq 1 64))"
export TWITCH_CLIENT_ID=smoke TWITCH_CLIENT_SECRET=smoke
export TWITCH_EXTENSION_CLIENT_ID=smokeext TWITCH_EXTENSION_SECRET="$(printf 'smoke-secret' | base64)"

[ -d node_modules ] || npm ci

# The server exits if its startup migration can't connect, so wait for Postgres.
echo "Waiting for Postgres..."
for i in $(seq 1 30); do
  node -e "new (require('pg').Client)(process.env.DATABASE_URL).connect().then(() => process.exit(0), () => process.exit(1))" && break
  [ "$i" = 30 ] && { echo "Postgres never became ready"; exit 1; }
  sleep 1
done

echo "Starting server on port $PORT..."
node server/index.js >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  curl -sf "$BASE/health" >/dev/null 2>&1 && break
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then echo "Server exited:"; cat "$SERVER_LOG"; exit 1; fi
  sleep 1
done

FAILED=0
check() { # check <description> <expected status> <curl args...>
  local desc=$1 expected=$2; shift 2
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [ "$status" = "$expected" ]; then
    echo "  ok   $desc ($status)"
  else
    echo "  FAIL $desc: expected $expected, got $status"
    FAILED=1
  fi
}

echo "Checking routes:"
check "health check"                      200 "$BASE/health"
check "landing page"                      200 "$BASE/"
check "dashboard redirects when signed out" 302 "$BASE/dashboard"
check "settings API needs a login"        401 "$BASE/api/settings"
check "unknown ticker key"                404 "$BASE/ticker/not-a-real-key"
check "extension: no token"               401 "$BASE/ext/status"
check "extension: bad token"              401 -H 'Authorization: Bearer a.b.c' "$BASE/ext/status"
check "extension: CORS preflight"         204 -X OPTIONS \
  -H 'Origin: https://smokeext.ext-twitch.tv' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization' "$BASE/ext/ticker"

if [ "$FAILED" = 1 ]; then
  echo "Smoke test failed. Server log:"
  cat "$SERVER_LOG"
  exit 1
fi
echo "Smoke test passed."
