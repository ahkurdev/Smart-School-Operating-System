#!/usr/bin/env bash
# SSOS API smoke test (requires API running on :4000 and seeded DB)
set -u
BASE="${1:-http://127.0.0.1:4000}"
fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi
}

check "health" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health")"

code=$(curl -s -o /tmp/smoke_login.json -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' -c /tmp/smoke_ck.txt)
check "login ok" 200 "$code"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"wrong-password"}')
check "login rejects bad password" 401 "$code"

check "me authenticated" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/me" -b /tmp/smoke_ck.txt)"
check "me unauthenticated blocked" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/me")"

check "refresh rotates" 200 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/refresh" -b /tmp/smoke_ck.txt -c /tmp/smoke_ck2.txt)"
check "old refresh reuse blocked" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/refresh" -b /tmp/smoke_ck.txt)"
check "session valid after rotation" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/me" -b /tmp/smoke_ck2.txt)"

curl -s -o /dev/null -X POST "$BASE/api/auth/logout" -b /tmp/smoke_ck2.txt
check "session dead after logout" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/me" -b /tmp/smoke_ck2.txt)"

exit $fail
