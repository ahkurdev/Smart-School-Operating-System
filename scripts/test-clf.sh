#!/usr/bin/env bash
# Counseling + Library + Finance tests. API on :4100.
set -u
RUN=$(date +%H%M%S)
TMPDIR="./.testtmp"
BASE="${1:-http://127.0.0.1:4100}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+process.argv[1])??'')}catch(e){console.log('')}})" "$1"; }

curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' -c $TMPDIR/clf_ck.txt -o /dev/null
AYID=$(curl -s "$BASE/api/school/academic-years" -b $TMPDIR/clf_ck.txt | J ".items.find(y=>y.isCurrent)?.id")
ST=$(curl -s -X POST "$BASE/api/students" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d "{\"nis\":\"C$RUN\",\"fullName\":\"Couns $RUN\",\"gender\":\"FEMALE\"}" | J ".id")

# Counseling
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/counseling" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d "{\"studentId\":\"$ST\",\"category\":\"AKADEMIK\",\"title\":\"Konseling $RUN\",\"notes\":\"rahasia\"}")
check "counseling create" 201 "$code"
CRID=$(curl -s "$BASE/api/counseling?studentId=$ST" -b $TMPDIR/clf_ck.txt | J ".items[0]?.id")
check "counseling list hides notes" "" "$(curl -s "$BASE/api/counseling?studentId=$ST" -b $TMPDIR/clf_ck.txt | J '.items[0]?.notes')"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/counseling/$CRID" -b $TMPDIR/clf_ck.txt)
check "counseling detail" 200 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/counseling/$CRID/complete" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d '{"action":"Follow up minggu depan"}')
check "counseling complete" 201 "$code"

# Library
code=$(curl -s -o $TMPDIR/book.json -w '%{http_code}' -X POST "$BASE/api/library/books" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d "{\"title\":\"Buku $RUN\",\"isbn\":\"978$RUN\",\"copies\":2}")
check "book create" 201 "$code"
COPY=$(cat $TMPDIR/book.json | J ".copies[0]?.id")
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/library/loans" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d "{\"studentId\":\"$ST\",\"copyId\":\"$COPY\",\"days\":7}")
check "borrow" 201 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/library/loans" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d "{\"studentId\":\"$ST\",\"copyId\":\"$COPY\"}")
check "double borrow blocked" 400 "$code"
LID=$(curl -s "$BASE/api/library/loans?studentId=$ST&status=BORROWED" -b $TMPDIR/clf_ck.txt | J ".items[0]?.id")
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/library/loans/$LID/return" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d '{}')
check "return" 201 "$code"

# Finance
FEE=$(curl -s -X POST "$BASE/api/finance/fees" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d "{\"kind\":\"SPP\",\"name\":\"SPP $RUN\",\"amount\":500000}" | J ".id")
INV=$(curl -s -X POST "$BASE/api/finance/invoices" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d "{\"studentId\":\"$ST\",\"feeItemId\":\"$FEE\",\"period\":\"2026-07\"}" | J ".id")
check "invoice created" 200 "$([ -n "$INV" ] && echo 200 || echo 404)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/finance/invoices" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d "{\"studentId\":\"$ST\",\"feeItemId\":\"$FEE\",\"period\":\"2026-07\"}")
check "duplicate billing blocked" 400 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/finance/invoices/$INV/pay" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d '{"amount":300000,"method":"CASH"}')
check "partial payment" 201 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/finance/invoices/$INV/pay" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d '{"amount":999999}')
check "overpay blocked" 400 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/finance/invoices/$INV/pay" -H 'Content-Type: application/json' -b $TMPDIR/clf_ck.txt -d '{"amount":200000}')
check "settle payment" 201 "$code"
TOT=$(curl -s "$BASE/api/finance/outstanding?studentId=$ST" -b $TMPDIR/clf_ck.txt | J ".total")
check "outstanding zero after settle" 0 "$TOT"

exit $fail
