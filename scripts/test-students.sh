#!/usr/bin/env bash
# Students + School API test (requires API on :4000, seeded)
set -u
RUN=$(date +%H%M%S)
BASE="${1:-http://127.0.0.1:4000}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }

curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"identity":"superadmin","password":"Admin#12345"}' -c /tmp/stud_ck.txt -o /dev/null

# Create student
code=$(curl -s -o /tmp/stud1.json -w '%{http_code}' -X POST "$BASE/api/students" \
  -H 'Content-Type: application/json' -b /tmp/stud_ck.txt \
  -d '{"nis":"2026R'$RUN'1","nisn":"0091'$RUN'567","fullName":"Siti Nurhaliza '$RUN' T","gender":"FEMALE","birthPlace":"Jakarta","entryYear":"2026"}')
check "create student" 201 "$code"
SID=$(node -e "console.log(require('/tmp/stud1.json').id||'')" 2>/dev/null || true)

# Duplicate detection
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/students" \
  -H 'Content-Type: application/json' -b /tmp/stud_ck.txt \
  -d '{"nis":"2026R'$RUN'1","fullName":"Dup Test","gender":"MALE"}')
check "duplicate NIS rejected" 400 "$code"

# List + search
code=$(curl -s -o /tmp/stud_list.json -w '%{http_code}' "$BASE/api/students?q=Siti" -b /tmp/stud_ck.txt)
check "list+search students" 200 "$code"
CNT=$(node -e "console.log(require('/tmp/stud_list.json').total)" 2>/dev/null || echo 0)
check "search finds student" 1 "$CNT"

# Validation: bad gender
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/students" \
  -H 'Content-Type: application/json' -b /tmp/stud_ck.txt \
  -d '{"nis":"2026002","fullName":"Bad Gender","gender":"X"}')
check "invalid gender rejected" 400 "$code"

# Update
if [ -n "$SID" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/students/$SID" \
    -H 'Content-Type: application/json' -b /tmp/stud_ck.txt -d '{"address":"Jl. Merdeka 10"}')
  check "update student" 200 "$code"

  # Create class + enroll
  AYID=$(curl -s "$BASE/api/school/academic-years" -b /tmp/stud_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.items.find(y=>y.isCurrent)?.id||'')})")
  code=$(curl -s -o /tmp/cls.json -w '%{http_code}' -X POST "$BASE/api/school/classes" \
    -H 'Content-Type: application/json' -b /tmp/stud_ck.txt \
    -d "{\"name\":\"X Test "$RUN"\",\"gradeLevel\":10,\"academicYearId\":\"$AYID\"}")
  check "create class" 201 "$code"
  CID=$(node -e "console.log(require('/tmp/cls.json').id||'')" 2>/dev/null)
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/students/$SID/enroll" \
    -H 'Content-Type: application/json' -b /tmp/stud_ck.txt -d "{\"classId\":\"$CID\"}")
  check "enroll student" 201 "$code"

  # Guardian link
  code=$(curl -s -o /tmp/g.json -w '%{http_code}' -X POST "$BASE/api/students/$SID/guardians" \
    -H 'Content-Type: application/json' -b /tmp/stud_ck.txt \
    -d '{"userId":"314164e9-2af5-40bc-8110-9ce556c13d93","relation":"MOTHER"}')
  check "link guardian" 201 "$code"
  GID=$(node -e "console.log(require('/tmp/g.json').id||'')" 2>/dev/null)

  # Tenant isolation: unknown school header rejected
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/students" -b /tmp/stud_ck.txt -H "X-School-Id: 00000000-0000-0000-0000-000000000000")
  check "cross-tenant school header blocked" 403 "$code"

  # Soft delete
  code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/students/$SID" -b /tmp/stud_ck.txt)
  check "soft delete student" 200 "$code"
  # Not visible after delete
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/students/$SID" -b /tmp/stud_ck.txt)
  check "deleted student hidden" 404 "$code"
fi

exit $fail
