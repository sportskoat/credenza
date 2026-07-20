#!/bin/bash
# Stop hook — checkpoint nag for the Credenza repo.
# If docs/session-state.md hasn't been touched in 45+ minutes, block the stop
# (exit 2) and tell Claude to update it before ending the turn. This replaces
# the unreliable auto-compact with a guaranteed fresh black box on disk.
INPUT=$(cat)
# Don't loop: if we already continued once because of a stop hook, let it stop.
echo "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0

STATE="/Users/kylewensel/credenza/docs/session-state.md"
[ -f "$STATE" ] || exit 0

MTIME=$(stat -f %m "$STATE")
NOW=$(date +%s)
AGE_MIN=$(( (NOW - MTIME) / 60 ))

if [ "$AGE_MIN" -gt 45 ]; then
  echo "CHECKPOINT STALE (${AGE_MIN} min): update /Users/kylewensel/credenza/docs/session-state.md — current state, decisions, next steps — then you may stop." >&2
  exit 2
fi
exit 0
