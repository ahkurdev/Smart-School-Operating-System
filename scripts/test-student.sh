#!/usr/bin/env bash
# Student portal + admin user management E2E
set -u
BASE="${1:-http://127.0.0.1:4100}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+process.argv[1])??'')}catch(e){console.log('')}})" "$1"; }

AT=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' | J ".accessToken")
check "admin login" 200 "$([ -n "$AT" ] && echo 200 || echo 401)"

RUN=$(date +%H%M%S)
S1=$(curl -s "$BASE/api/students?page=1&take=5" -H "Authorization: Bearer $AT" | J ".items[0]?.id")
check "student found" 200 "$([ -n "$S1" ] && echo 200 || echo 404)"

# admin creates student login user
NUID=$(curl -s -X POST "$BASE/api/users" -H 'Content-Type: application/json' -H "Authorization: Bearer $AT" -d "{\"username\":\"siswa$RUN\",\"fullName\":\"Siswa $RUN\",\"tempPassword\":\"Siswa#12345\",\"role\":\"SISWA\"}" | J ".id")
check "user create" 200 "$([ -n "$NUID" ] && echo 200 || echo 404)"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/users" -H 'Content-Type: application/json' -H "Authorization: Bearer $AT" -d "{\"username\":\"siswa$RUN\",\"fullName\":\"Dup\",\"tempPassword\":\"Siswa#12345\"}")
check "duplicate user blocked" 400 "$code"

N=$(curl -s "$BASE/api/users?q=siswa$RUN" -H "Authorization: Bearer $AT" | J ".items.length")
check "user listed (no hashes)" 1 "$N"
curl -s "$BASE/api/users?q=siswa$RUN" -H "Authorization: Bearer $AT" | grep -q passwordHash && { echo "FAIL hash leak"; fail=1; } || echo "PASS no hash leak"

# link user to student
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/student/$S1/link-user" -H 'Content-Type: application/json' -H "Authorization: Bearer $AT" -d "{\"userId\":\"$NUID\"}")
check "link-user" 201 "$code"

# student login + self reads
ST=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"identity\":\"siswa$RUN\",\"password\":\"Siswa#12345\"}" | J ".accessToken")
check "student login" 200 "$([ -n "$ST" ] && echo 200 || echo 401)"

for ep in me timetable assignments grades attendance; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/student/me/$ep" -H "Authorization: Bearer $ST")
  # me is at /api/student/me (no suffix)
  if [ "$ep" = "me" ]; then code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/student/me" -H "Authorization: Bearer $ST"); fi
  check "student self $ep" 200 "$code"
done

# negative: student on admin endpoints
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/students?page=1&take=2" -H "Authorization: Bearer $ST")
check "admin students as siswa blocked" 403 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/users" -H "Authorization: Bearer $ST")
check "user list as siswa blocked" 403 "$code"

# negative: unlinked user gets scoped 400, not чужой data
UID2=$(curl -s -X POST "$BASE/api/users" -H 'Content-Type: application/json' -H "Authorization: Bearer $AT" -d "{\"username\":\"siswa2$RUN\",\"fullName\":\"Siswa2 $RUN\",\"tempPassword\":\"Siswa#12345\",\"role\":\"SISWA\"}" | J ".id")
ST2=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"identity\":\"siswa2$RUN\",\"password\":\"Siswa#12345\"}" | J ".accessToken")
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/student/me" -H "Authorization: Bearer $ST2")
check "unlinked student blocked" 400 "$code"

# admin password reset revokes sessions
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/users/$NUID/reset-password" -H 'Content-Type: application/json' -H "Authorization: Bearer $AT" -d '{"tempPassword":"Baru#12345"}')
check "password reset" 201 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/student/me" -H "Authorization: Bearer $ST")
check "old session revoked after reset" 401 "$code"
code=$(curl -s -o /tmp/st3.json -w '%{http_code}' -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"identity\":\"siswa$RUN\",\"password\":\"Baru#12345\"}")
check "login with new password" 200 "$code"

exit $fail
