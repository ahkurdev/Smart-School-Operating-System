#!/usr/bin/env bash
# PPDB workflow test. API on :4100.
set -u
RUN=$(date +%H%M%S)
TMPDIR="./.testtmp"
BASE="${1:-http://127.0.0.1:4100}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+process.argv[1])??'')}catch(e){console.log('')}})" "$1"; }

curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' -c $TMPDIR/ppdb_ck.txt -o /dev/null

REG=$(curl -s -X POST "$BASE/api/ppdb/registrations" -H 'Content-Type: application/json' -b $TMPDIR/ppdb_ck.txt -d "{\"fullName\":\"Calon Siswa $RUN\",\"gender\":\"MALE\",\"originSchool\":\"SMP Negeri $RUN\"}" | J ".id")
check "register" 201 "$([ -n "$REG" ] && echo 201 || echo 404)"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ppdb/registrations/$REG/decide" -H 'Content-Type: application/json' -b $TMPDIR/ppdb_ck.txt -d '{"action":"SELECT"}')
check "select before verify blocked" 400 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ppdb/registrations/$REG/decide" -H 'Content-Type: application/json' -b $TMPDIR/ppdb_ck.txt -d '{"action":"VERIFY"}')
check "verify" 201 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ppdb/registrations/$REG/decide" -H 'Content-Type: application/json' -b $TMPDIR/ppdb_ck.txt -d '{"action":"SELECT"}')
check "select" 201 "$code"

NIS="PP$RUN"
ENR=$(curl -s -X POST "$BASE/api/ppdb/registrations/$REG/enroll" -H 'Content-Type: application/json' -b $TMPDIR/ppdb_ck.txt -d "{\"nis\":\"$NIS\"}")
SID=$(echo "$ENR" | J ".studentId")
check "enroll creates student" 200 "$([ -n "$SID" ] && echo 200 || echo 404)"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/students/$SID" -b $TMPDIR/ppdb_ck.txt)
check "enrolled student exists" 200 "$code"

exit $fail
