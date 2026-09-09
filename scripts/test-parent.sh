#!/usr/bin/env bash
# Parent portal E2E: link parent -> parent login -> scoped reads -> negative tests
set -u
BASE="${1:-http://127.0.0.1:4100}"
TMPDIR="./.testtmp"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+process.argv[1])??'')}catch(e){console.log('')}})" "$1"; }

AT=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' | J ".accessToken")
check "admin login" 200 "$([ -n "$AT" ] && echo 200 || echo 401)"

S1=$(curl -s "$BASE/api/students?page=1&take=5" -H "Authorization: Bearer $AT" | J ".items[0]?.id")
S2=$(curl -s "$BASE/api/students?page=1&take=5" -H "Authorization: Bearer $AT" | J ".items[1]?.id")
check "two students found" 200 "$([ -n "$S1" ] && [ -n "$S2" ] && echo 200 || echo 404)"

RUN=$(date +%H%M%S)
LINK=$(curl -s -X POST "$BASE/api/parent/link" -H 'Content-Type: application/json' -H "Authorization: Bearer $AT" -d "{\"email\":\"ortu$RUN@ssos.local\",\"fullName\":\"Ortu $RUN\",\"studentId\":\"$S1\",\"relation\":\"FATHER\",\"tempPassword\":\"Ortu#12345\"}")
echo "$LINK" | grep -q guardianId && echo "PASS parent link" || { echo "FAIL parent link: $LINK"; fail=1; }
echo "$LINK" | grep -q '"created":true' && echo "PASS link created flag" || { echo "FAIL created flag: $LINK"; fail=1; }

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/parent/link" -H 'Content-Type: application/json' -H "Authorization: Bearer $AT" -d "{\"email\":\"ortu$RUN@ssos.local\",\"fullName\":\"Ortu $RUN\",\"studentId\":\"$S1\",\"tempPassword\":\"Ortu#12345\"}")
check "duplicate link blocked" 400 "$code"

PT=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"identity\":\"ortu$RUN@ssos.local\",\"password\":\"Ortu#12345\"}" | J ".accessToken")
check "parent login" 200 "$([ -n "$PT" ] && echo 200 || echo 401)"

N=$(curl -s "$BASE/api/parent/children" -H "Authorization: Bearer $PT" | J ".items.length")
check "parent sees 1 child" 1 "$N"

for ep in attendance grades report-cards; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/parent/children/$S1/$ep" -H "Authorization: Bearer $PT")
  check "own-child $ep" 200 "$code"
done

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/parent/children/$S2/attendance" -H "Authorization: Bearer $PT")
check "other-child blocked" 400 "$code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/students?page=1&take=2" -H "Authorization: Bearer $PT")
check "admin students as parent blocked" 403 "$code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/parent/link" -H 'Content-Type: application/json' -H "Authorization: Bearer $PT" -d "{\"email\":\"x@ssos.local\",\"fullName\":\"X\",\"studentId\":\"$S2\",\"tempPassword\":\"Xxxx#12345\"}")
check "link as parent blocked" 403 "$code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/parent/children/$S1/attendance?from=2026-01-01&to=2026-12-31" -H "Authorization: Bearer $PT")
check "attendance from/to range" 200 "$code"

exit $fail
