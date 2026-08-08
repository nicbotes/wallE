#!/usr/bin/env bash
# The commit gate for brain findings. Skills MUST commit through this script —
# it enforces the taxonomy and trailer format from schema/FINDINGS.md and
# stages ONLY the files named on the command line.
#
# Usage:
#   tools/commit-finding.sh -c <client> -t <finding-type> -e <entity> -s <source-drop> \
#       [-p <project>] [-a <attributed-to>] [-r <refs,comma,separated>] [-B] \
#       -m "<summary>" [-b "<body>"] <file>...
#
# -B marks the finding as backfill: its event date predates the source drop
#    (we learned something old). See schema/SCHEMA.md "Two clocks".
set -euo pipefail

TYPES="brain-init drop stakeholder-new stakeholder-update incentive-new incentive-update observation-new observation-update requirement-new requirement-update decision-new decision-superseded scope-move tension-opened tension-resolved project-new project-update log-entry confirm correction domain-attach"

CLIENT="" TYPE="" ENTITY="" SOURCE="" PROJECT="" ATTR="" REFS="" SUMMARY="" BODY="" BACKFILL=""
while getopts "c:t:e:s:p:a:r:m:b:B" flag; do
  case "$flag" in
    c) CLIENT="$OPTARG" ;;
    t) TYPE="$OPTARG" ;;
    e) ENTITY="$OPTARG" ;;
    s) SOURCE="$OPTARG" ;;
    p) PROJECT="$OPTARG" ;;
    a) ATTR="$OPTARG" ;;
    r) REFS="$OPTARG" ;;
    m) SUMMARY="$OPTARG" ;;
    b) BODY="$OPTARG" ;;
    B) BACKFILL="true" ;;
    *) exit 2 ;;
  esac
done
shift $((OPTIND - 1))

fail() { echo "commit-finding: $*" >&2; exit 1; }

[ -n "$CLIENT" ]  || fail "missing -c <client>"
[ -n "$TYPE" ]    || fail "missing -t <finding-type>"
[ -n "$ENTITY" ]  || fail "missing -e <entity>"
[ -n "$SOURCE" ]  || fail "missing -s <source-drop>"
[ -n "$SUMMARY" ] || fail "missing -m <summary>"
[ "$#" -ge 1 ]    || fail "no files named"

echo "$TYPES" | tr ' ' '\n' | grep -qx "$TYPE" || fail "unknown finding type: $TYPE"
[ "${#SUMMARY}" -le 72 ] || fail "summary exceeds 72 chars (${#SUMMARY})"

# Nothing may already be staged — one finding, one commit, only named files.
if ! git diff --cached --quiet; then
  fail "index is not clean; unstage first (git reset)"
fi

git add -- "$@"

if git diff --cached --quiet; then
  fail "named files have no changes to commit"
fi

MSG="$TYPE($CLIENT): $SUMMARY

"
if [ -n "$BODY" ]; then
  MSG+="$BODY

"
fi
MSG+="Client: $CLIENT
"
if [ -n "$PROJECT" ]; then MSG+="Project: $PROJECT
"; fi
MSG+="Finding: $TYPE
Entity: $ENTITY
"
if [ -n "$REFS" ]; then MSG+="Refs: $REFS
"; fi
if [ -n "$ATTR" ]; then MSG+="Attributed-To: $ATTR
"; fi
if [ -n "$BACKFILL" ]; then MSG+="Backfill: true
"; fi
MSG+="Source: $SOURCE"

git commit --quiet -m "$MSG"
git log -1 --format='%h %s'
