#!/usr/bin/env bash
# Public site CMS test. API on :4100.
set -u
RUN=$(date +%H%M%S)
TMPDIR="./.testtmp"
BASE="${1:-http://127.0.0.1:4100}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (want $2 got $3)"; fail=1; fi; }
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(eval('j'+process.argv[1])??'')}catch(e){console.log('')}})" "$1"; }

curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identity":"superadmin","password":"Admin#12345"}' -c $TMPDIR/site_ck.txt -o /dev/null

# Public access WITHOUT auth (school code SMA-DEMO from seed)
code=$(curl -s -o $TMPDIR/pub.json -w '%{http_code}' "$BASE/api/site/public/SMA-DEMO/content")
check "public content no-auth" 200 "$code"
SCH=$(cat $TMPDIR/pub.json | J ".school?.name")
check "public school name" "SMA Demo Nusantara" "$SCH"

# Admin adds content
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/site/content" -H 'Content-Type: application/json' -b $TMPDIR/site_ck.txt -d "{\"section\":\"PROFILE\",\"title\":\"Sejarah $RUN\",\"body\":\"Berdiri tahun 1990\",\"published\":true}")
check "content upsert" 201 "$code"
N=$(curl -s "$BASE/api/site/public/SMA-DEMO/content?section=PROFILE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).contents.filter(c=>c.title.includes('$RUN')).length)})")
check "content publicly visible" 1 "$N"

# News
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/site/news" -H 'Content-Type: application/json' -b $TMPDIR/site_ck.txt -d "{\"title\":\"Berita $RUN\",\"body\":\"Isi berita\",\"publish\":true}")
check "news create" 201 "$code"
N2=$(curl -s "$BASE/api/site/public/SMA-DEMO/news" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).items.filter(i=>i.title.includes('$RUN')).length)})")
check "news publicly visible" 1 "$N2"

# Teachers public (name+position only)
T=$(curl -s "$BASE/api/site/public/SMA-DEMO/teachers")
check "public teachers no-auth" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/site/public/SMA-DEMO/teachers")"
LEAK=$(echo "$T" | grep -c "passwordHash\|email")
check "no sensitive leak" 0 "$LEAK"

exit $fail
