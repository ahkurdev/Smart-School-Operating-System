#!/usr/bin/env bash
# Timetable conflict detection + attendance bulk tests. API on :4100, seeded.
set -u
RUN=$(date +%H%M%S%N | cut -c1-10)
BASE="${1:-http://127.0.0.1:4100}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }

curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"identity":"superadmin","password":"Admin#12345"}' -c /tmp/tt_ck.txt -o /dev/null

AYID=$(curl -s "$BASE/api/school/academic-years" -b /tmp/tt_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.items.find(y=>y.isCurrent)?.id||'')})")
TUID=$(curl -s "$BASE/api/auth/me" -b /tmp/tt_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).userId)})")

# Setup: 2 subjects, 1 class, 2 students
S1=$(curl -s -X POST "$BASE/api/school/subjects" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt -d "{\"code\":\"M$RUN\",\"name\":\"Matematika $RUN\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id||'')})")
S2=$(curl -s -X POST "$BASE/api/school/subjects" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt -d "{\"code\":\"F$RUN\",\"name\":\"Fisika $RUN\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id||'')})")
CLS=$(curl -s -X POST "$BASE/api/school/classes" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt -d "{\"name\":\"TT $RUN\",\"gradeLevel\":10,\"academicYearId\":\"$AYID\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id||'')})")
ST1=$(curl -s -X POST "$BASE/api/students" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt -d "{\"nis\":\"A$RUN\",\"fullName\":\"Ani $RUN\",\"gender\":\"FEMALE\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id||'')})")
ST2=$(curl -s -X POST "$BASE/api/students" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt -d "{\"nis\":\"B$RUN\",\"fullName\":\"Budi $RUN\",\"gender\":\"MALE\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id||'')})")

# Slot 1: Monday 07:00-07:45 teacher=superadmin
code=$(curl -s -o /tmp/slot1.json -w '%{http_code}' -X POST "$BASE/api/timetable" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt \
  -d "{\"classId\":\"$CLS\",\"subjectId\":\"$S1\",\"teacherUserId\":\"$UID_SUPER\",\"dayOfWeek\":1,\"startTime\":\"07:00\",\"endTime\":\"07:45\"}")
check "create slot 1" 201 "$code"

# Slot 2 same teacher same time -> teacher conflict
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/timetable" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt \
  -d "{\"classId\":\"$CLS\",\"subjectId\":\"$S2\",\"teacherUserId\":\"$UID_SUPER\",\"dayOfWeek\":1,\"startTime\":\"07:30\",\"endTime\":\"08:15\"}")
check "teacher conflict blocked" 400 "$code"

# Slot 2 same class same time -> class conflict
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/timetable" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt \
  -d "{\"classId\":\"$CLS\",\"subjectId\":\"$S2\",\"teacherUserId\":\"$UID_SUPER\",\"dayOfWeek\":1,\"startTime\":\"07:10\",\"endTime\":\"07:40\"}")
check "class conflict blocked" 400 "$code"

# Attendance bulk
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/attendance" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt \
  -d "{\"date\":\"2026-09-07\",\"entries\":[{\"personId\":\"$ST1\",\"status\":\"PRESENT\"},{\"personId\":\"$ST2\",\"status\":\"ABSENT\",\"note\":\"tanpa keterangan\"}]}")
check "bulk attendance" 201 "$code"

# Cross-tenant student rejected
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/attendance" -H 'Content-Type: application/json' -b /tmp/tt_ck.txt \
  -d "{\"date\":\"2026-09-07\",\"entries\":[{\"personId\":\"00000000-0000-0000-0000-000000000000\",\"status\":\"PRESENT\"}]}")
check "attendance foreign student blocked" 400 "$code"

# Absent list
code=$(curl -s -o /tmp/abs.json -w '%{http_code}' "$BASE/api/attendance/absent?date=2026-09-07" -b /tmp/tt_ck.txt)
check "absent list" 200 "$code"
N=$(node -e "console.log(require('/tmp/abs.json').items.length)" 2>/dev/null || echo 0)
check "absent list has 1" 1 "$N"

# Summary
code=$(curl -s -o /tmp/sum.json -w '%{http_code}' "$BASE/api/attendance?date=2026-09-07" -b /tmp/tt_ck.txt)
check "attendance summary" 200 "$code"

exit $fail
