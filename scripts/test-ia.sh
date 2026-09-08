#!/usr/bin/env bash
# IoT + Automation tests. API on :4100.
set -u
RUN=$(date +%H%M%S)
TMPDIR="./.testtmp"
BASE="${1:-http://127.0.0.1:4100}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+process.argv[1])??'')}catch(e){console.log('')}})" "$1"; }

curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' -c $TMPDIR/ia_ck.txt -o /dev/null
TUID=$(curl -s "$BASE/api/auth/me" -b $TMPDIR/ia_ck.txt | J ".userId")

# Device register
DEV=$(curl -s -X POST "$BASE/api/iot/devices" -H 'Content-Type: application/json' -b $TMPDIR/ia_ck.txt -d "{\"deviceId\":\"sensor-$RUN\",\"name\":\"Sensor $RUN\",\"kind\":\"SENSOR_TEMP\"}" | J ".id")
check "device register" 200 "$([ -n "$DEV" ] && echo 200 || echo 404)"

# Telemetry ingest (public gateway endpoint)
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/iot/telemetry" -H 'Content-Type: application/json' -d "{\"deviceId\":\"sensor-$RUN\",\"battery\":80,\"metrics\":[{\"metric\":\"temperature\",\"value\":29.5,\"unit\":\"C\"}]}")
check "telemetry ingest" 202 "$code"
ONLINE=$(curl -s "$BASE/api/iot/devices?status=ONLINE" -b $TMPDIR/ia_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).items.filter(i=>i.deviceId==='sensor-$RUN').length)})")
check "device online after telemetry" 1 "$ONLINE"

# Threshold breach -> alert
curl -s -o /dev/null -X POST "$BASE/api/iot/telemetry" -H 'Content-Type: application/json' -d "{\"deviceId\":\"sensor-$RUN\",\"metrics\":[{\"metric\":\"temperature\",\"value\":41.2}]}"
ALERTS=$(curl -s "$BASE/api/iot/alerts?unresolved=1" -b $TMPDIR/ia_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).items.filter(i=>i.kind==='SENSOR_THRESHOLD').length)})")
check "threshold alert created" 1 "$ALERTS"

# Unknown device rejected
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/iot/telemetry" -H 'Content-Type: application/json' -d "{\"deviceId\":\"ghost-$RUN\",\"metrics\":[{\"metric\":\"temperature\",\"value\":20}]}")
check "unknown device rejected" 400 "$code"

# Automation: rule student.absent -> notify_guardian
RULE=$(curl -s -X POST "$BASE/api/automation/rules" -H 'Content-Type: application/json' -b $TMPDIR/ia_ck.txt -d "{\"name\":\"Notif Alpha $RUN\",\"event\":\"student.absent\",\"action\":\"create_alert\"}" | J ".id")
check "rule create" 200 "$([ -n "$RULE" ] && echo 200 || echo 404)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/automation/emit" -H 'Content-Type: application/json' -b $TMPDIR/ia_ck.txt -d "{\"event\":\"student.absent\",\"payload\":{\"studentId\":\"x\",\"nis\":\"123\"}}")
check "event emit" 202 "$code"
ALERTS2=$(curl -s "$BASE/api/iot/alerts?unresolved=1" -b $TMPDIR/ia_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).items.filter(i=>i.kind==='CUSTOM').length)})")
check "rule fired alert" 1 "$ALERTS2"
EV=$(curl -s "$BASE/api/automation/events?event=student.absent" -b $TMPDIR/ia_ck.txt | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).items.length)})")
check "event logged" 1 "$EV"

exit $fail
