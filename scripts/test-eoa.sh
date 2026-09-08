#!/usr/bin/env bash
# Ekskul + UKS/Canteen/Bus + Announcements tests. API on :4100.
set -u
RUN=$(date +%H%M%S)
TMPDIR="./.testtmp"
BASE="${1:-http://127.0.0.1:4100}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+process.argv[1])??'')}catch(e){console.log('')}})" "$1"; }

curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' -c $TMPDIR/eoa_ck.txt -o /dev/null
ST=$(curl -s -X POST "$BASE/api/students" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d "{\"nis\":\"E$RUN\",\"fullName\":\"Ekskul $RUN\",\"gender\":\"FEMALE\"}" | J ".id")

# Ekskul
EK=$(curl -s -X POST "$BASE/api/ekskul" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d "{\"name\":\"Pramuka $RUN\",\"kind\":\"CLUB\",\"schedule\":\"Jumat 14:00\"}" | J ".id")
check "ekskul create" 200 "$([ -n "$EK" ] && echo 200 || echo 404)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ekskul/$EK/members" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d "{\"studentId\":\"$ST\",\"role\":\"ANGGOTA\"}")
check "ekskul member" 201 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ekskul/achievements" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d "{\"studentId\":\"$ST\",\"title\":\"Juara Lomba $RUN\",\"type\":\"OLAHRAGA\",\"level\":\"PROVINCE\",\"rank\":1,\"year\":2026}")
check "achievement create" 201 "$code"
N=$(curl -s "$BASE/api/ekskul/achievements?year=2026" -b $TMPDIR/eoa_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).items.filter(i=>i.title.includes('$RUN')).length)})")
check "achievement listed" 1 "$N"

# UKS
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ops/uks/visits" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d "{\"studentId\":\"$ST\",\"complaint\":\"Demam\",\"temperatureC\":38.5,\"parentContacted\":true}")
check "uks visit" 201 "$code"
V=$(curl -s "$BASE/api/ops/uks/visits?studentId=$ST" -b $TMPDIR/eoa_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).items.length)})")
check "uks visit listed" 1 "$V"

# Canteen
VEND=$(curl -s -X POST "$BASE/api/ops/canteen/vendors" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d "{\"name\":\"Kantin $RUN\"}" | J ".id")
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ops/canteen/vendors/$VEND/menus" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d '{"name":"Nasi Goreng","price":10000}')
check "canteen menu" 201 "$code"

# Bus
BUS=$(curl -s -X POST "$BASE/api/ops/buses" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d "{\"plateNumber\":\"B$RUN\",\"capacity\":30,\"driverName\":\"Pak $RUN\"}" | J ".id")
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ops/buses/$BUS/routes" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d "{\"name\":\"Rute $RUN\",\"departTime\":\"06:30\",\"stops\":[{\"name\":\"Gerbang\",\"time\":\"06:40\"}]}")
check "bus route" 201 "$code"

# Announcements
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/announcements" -H 'Content-Type: application/json' -b $TMPDIR/eoa_ck.txt -d "{\"title\":\"Pengumuman $RUN\",\"body\":\"Isi pengumuman\",\"audience\":\"ALL\"}")
check "announcement create" 201 "$code"
A=$(curl -s "$BASE/api/announcements" -b $TMPDIR/eoa_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).items.filter(i=>i.title.includes('$RUN')).length)})")
check "announcement listed" 1 "$A"

exit $fail
