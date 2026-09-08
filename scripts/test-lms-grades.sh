#!/usr/bin/env bash
# LMS + Assignments + Gradebook workflow tests. API on :4100.
TMPDIR="./.testtmp"
set -u
RUN=$(date +%H%M%S)
BASE="${1:-http://127.0.0.1:4100}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+process.argv[1])??'')}catch(e){console.log('')}})" "$1"; }

curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' -c $TMPDIR/lms_ck.txt -o /dev/null
AYID=$(curl -s "$BASE/api/school/academic-years" -b $TMPDIR/lms_ck.txt | J ".items.find(y=>y.isCurrent)?.id")
SEMID=$(curl -s "$BASE/api/school/academic-years" -b $TMPDIR/lms_ck.txt | J ".items.find(y=>y.isCurrent)?.semesters?.[0]?.id" )
TUID=$(curl -s "$BASE/api/auth/me" -b $TMPDIR/lms_ck.txt | J ".userId")
SUBJ=$(curl -s -X POST "$BASE/api/school/subjects" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"code\":\"L$RUN\",\"name\":\"LMS Mapel $RUN\"}" | J ".id")
CLS=$(curl -s -X POST "$BASE/api/school/classes" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"name\":\"LMS $RUN\",\"gradeLevel\":11,\"academicYearId\":\"$AYID\"}" | J ".id")
ST=$(curl -s -X POST "$BASE/api/students" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"nis\":\"L$RUN\",\"fullName\":\"Learner $RUN\",\"gender\":\"MALE\"}" | J ".id")

COURSE=$(curl -s -X POST "$BASE/api/lms/courses" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"subjectId\":\"$SUBJ\",\"classId\":\"$CLS\",\"teacherUserId\":\"$TUID\",\"name\":\"Kelas $RUN\"}")
CID=$(echo "$COURSE" | J ".id")
check "create course" 200 "$([ -n "$CID" ] && echo 200 || echo 404)"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/lms/courses/$CID/materials" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d '{"title":"Pengantar","kind":"TEXT","body":"Materi bab 1"}')
check "add material" 201 "$code"

code=$(curl -s -o $TMPDIR/asg.json -w '%{http_code}' -X POST "$BASE/api/lms/courses/$CID/assignments" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d '{"title":"Tugas 1","kind":"ESSAY","maxScore":100,"weight":2}')
check "create assignment" 201 "$code"
ASGID=$(cat $TMPDIR/asg.json | J ".id")

code=$(curl -s -o $TMPDIR/sub.json -w '%{http_code}' -X POST "$BASE/api/lms/assignments/$ASGID/submissions" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"studentId\":\"$ST\",\"content\":\"Jawaban saya...\",\"status\":\"SUBMITTED\"}")
check "submit assignment" 201 "$code"
SUBID=$(cat $TMPDIR/sub.json | J ".id")

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/lms/submissions/$SUBID/grade" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d '{"score":88,"feedback":"Bagus"}')
check "grade submission" 201 "$code"

# Gradebook: input 2 grades, workflow SUBMIT->APPROVE->PUBLISH
curl -s -o /dev/null -X POST "$BASE/api/grades" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"studentId\":\"$ST\",\"subjectId\":\"$SUBJ\",\"semesterId\":\"$SEMID\",\"component\":\"ASSIGNMENT\",\"score\":80,\"weight\":2}"
curl -s -o /dev/null -X POST "$BASE/api/grades" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"studentId\":\"$ST\",\"subjectId\":\"$SUBJ\",\"semesterId\":\"$SEMID\",\"component\":\"EXAM\",\"score\":90,\"weight\":1}"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/grades/workflow" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"action\":\"SUBMIT\",\"semesterId\":\"$SEMID\"}")
check "grade submit" 201 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/grades/workflow" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"action\":\"APPROVE\",\"semesterId\":\"$SEMID\"}")
check "grade approve" 201 "$code"
code=$(curl -s -o /tmp/pub.json -w '%{http_code}' -X POST "$BASE/api/grades/workflow" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"action\":\"PUBLISH\",\"semesterId\":\"$SEMID\"}")
check "grade publish" 201 "$code"

# Verify rapor QR (public endpoint)
VC=$(curl -s "$BASE/api/grades?studentId=$ST&semesterId=$SEMID" -b $TMPDIR/lms_ck.txt | J ".items[0]?.studentId")
RC=$(curl -s -X POST "$BASE/api/grades/workflow" -H 'Content-Type: application/json' -b $TMPDIR/lms_ck.txt -d "{\"action\":\"PUBLISH\",\"semesterId\":\"$SEMID\"}" -o /dev/null -w '%{http_code}')
# get verify code from report card via student grades listing is not exposed; check verify endpoint rejects garbage
code=$(curl -s -o $TMPDIR/v.json -w '%{http_code}' "$BASE/api/grades/report-cards/verify/not-a-real-code")
check "rapor verify rejects invalid" 200 "$code"
V=$(cat $TMPDIR/v.json | J ".valid")
check "rapor verify invalid=false" false "$V"

exit $fail
