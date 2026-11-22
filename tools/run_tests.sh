#!/bin/bash
# Runs the VPEX browser tests (tests/*.js) against this folder, served at http://127.0.0.1:${PORT:-8765}.
#   tools/run_tests.sh                    every test file
#   tools/run_tests.sh tests/smoke.js ... just these
#   SHARD=2 SHARDS=6 tools/run_tests.sh   every 6th file starting at the 2nd (how GitHub splits the run)
# Files run ${PAR:-2} at a time. A file that fails is run once more on its own: a few checks measure speed (a dial must
# reach the admin within 1.5 s), and a busy machine can miss by a hair. A file that fails twice fails the run, and its
# failing checks are printed. Needs Node with Playwright (NODE_PATH) and Python 3.
set -u
cd "$(dirname "$0")/.."
PORT=${PORT:-8765}; PAR=${PAR:-2}; OUT=${OUT:-$(mktemp -d)}; mkdir -p "$OUT"
if [ $# -gt 0 ]; then FILES="$*"; else FILES=$(ls tests/*.js); fi
if [ -n "${SHARD:-}" ]; then FILES=$(echo $FILES | tr ' ' '\n' | awk -v s="$SHARD" -v n="${SHARDS:-1}" '(NR - 1) % n == s - 1'); fi

if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
  trap 'kill $SRV 2>/dev/null' EXIT
  for i in $(seq 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.2; done
fi
export BASE="http://127.0.0.1:$PORT/index.html" OUT

one() {   # run one file, print "exit name summary"
  local f=$1 n; n=$(basename "$f" .js)
  timeout 900 node "$f" > "$OUT/$n.log" 2>&1; local x=$?
  echo "$x $n $(grep -E '[0-9]+ passed' "$OUT/$n.log" | tail -1)"
}
export -f one

echo "$FILES" | tr ' ' '\n' | grep . | xargs -P "$PAR" -I{} bash -c 'one {}' | tee "$OUT/first.txt"
FAILED=$(awk '$1 != 0 { print $2 }' "$OUT/first.txt")
BAD=""
for n in $FAILED; do
  echo "--- $n failed; running it again on its own"
  cp "$OUT/$n.log" "$OUT/$n.first.log"
  r=$(one "tests/$n.js"); echo "$r"
  [ "${r%% *}" = "0" ] || BAD="$BAD $n"
done

TOTAL=$(echo "$FILES" | tr ' ' '\n' | grep -c .)
{
  echo "### VPEX app tests: $((TOTAL - $(echo $BAD | wc -w))) of $TOTAL files passed"
  for n in $FAILED; do case " $BAD " in *" $n "*) ;; *) echo "- $n passed on the second run (timing on a busy machine)";; esac; done
  for n in $BAD; do echo "- **$n failed twice**"; echo '```'; grep -E '^FAIL' "$OUT/$n.log" | cut -c1-400 | head -20; grep -E 'Error|error' "$OUT/$n.log" | head -5; echo '```'; done
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
[ -z "$BAD" ]
