#!/usr/bin/env bash
# Scholarship + Assets + HR tests. API on :4100.
set -u
RUN=$(date +%H%M%S)
TMPDIR="./.testtmp"
BASE="${1:-http://127.0.0.1:4100}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+process.argv[1])??'')}catch(e){console.log('')}})" "$1"; }

curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' -c $TMPDIR/sah_ck.txt -o /dev/null
ST=$(curl -s -X POST "$BASE/api/students" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d "{\"nis\":\"S$RUN\",\"fullName\":\"Scholar $RUN\",\"gender\":\"MALE\"}" | J ".id")

# Scholarship workflow
PROG=$(curl -s -X POST "$BASE/api/scholarship/programs" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d "{\"name\":\"Beasiswa $RUN\",\"period\":\"2026\",\"quota\":5}" | J ".id")
APP=$(curl -s -X POST "$BASE/api/scholarship/programs/$PROG/apply" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d "{\"studentId\":\"$ST\"}" | J ".id")
check "scholarship apply" 200 "$([ -n "$APP" ] && echo 200 || echo 404)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/scholarship/applications/$APP/decide" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d '{"action":"APPROVE"}')
check "approve from APPLIED blocked" 400 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/scholarship/applications/$APP/decide" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d '{"action":"VERIFY"}')
check "verify" 201 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/scholarship/applications/$APP/decide" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d '{"action":"REVIEW"}')
check "review" 201 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/scholarship/applications/$APP/decide" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d '{"action":"APPROVE","reviewNotes":"layak"}')
check "approve" 201 "$code"

# Assets
ROOM=$(curl -s "$BASE/api/school/rooms" -b $TMPDIR/sah_ck.txt | J ".items[0]?.id")
AST=$(curl -s -X POST "$BASE/api/assets" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d "{\"name\":\"Proyektor $RUN\",\"category\":\"ELECTRONIC\",\"value\":5000000$( [ -n "$ROOM" ] && echo ",\"roomId\":\"$ROOM\"" )}" | J ".id")
check "asset create" 200 "$([ -n "$AST" ] && echo 200 || echo 404)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/assets/$AST/maintenance" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d '{"description":"Lampu mati"}')
check "maintenance schedule" 201 "$code"
MID=$(curl -s "$BASE/api/assets/maintenance/due" -b $TMPDIR/sah_ck.txt | J ".items[0]?.id")
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/assets/maintenance/$MID/complete" -b $TMPDIR/sah_ck.txt)
check "maintenance complete" 201 "$code"

# HR
EMP=$(curl -s -X POST "$BASE/api/hr/employees" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d "{\"nip\":\"N$RUN\",\"fullName\":\"Guru $RUN\",\"position\":\"Guru Mapel\"}" | J ".id")
check "employee create" 200 "$([ -n "$EMP" ] && echo 200 || echo 404)"
LV=$(curl -s -X POST "$BASE/api/hr/employees/$EMP/leave" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d "{\"kind\":\"SICK\",\"fromDate\":\"2026-09-07\",\"toDate\":\"2026-09-08\",\"reason\":\"Demam\"}" | J ".id")
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/hr/leave/$LV/decide" -H 'Content-Type: application/json' -b $TMPDIR/sah_ck.txt -d '{"action":"APPROVE"}')
check "leave approve" 201 "$code"

exit $fail
