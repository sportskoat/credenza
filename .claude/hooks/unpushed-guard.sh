#!/bin/bash
# Stop hook — the progress-loss guard for the Credenza repo.
#
# Added 2026-07-26 after an audit found 4,244 uncommitted lines and 11
# unpushed commits spread across four worktrees. All of it lived on one
# laptop. The old rule "do not commit until Kyle says so" caused it.
#
# This hook blocks the end of a turn while any worktree holds work that
# GitHub does not have. Committing is not shipping and pushing is not
# shipping — only `netlify deploy --prod` ships. So there is never a
# reason to leave work unpushed.
INPUT=$(cat)
# Don't loop: if we already continued once because of a stop hook, let it stop.
echo "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0

REPO="/Users/kylewensel/credenza"
cd "$REPO" 2>/dev/null || exit 0
command -v git >/dev/null 2>&1 || exit 0

PROBLEMS=""

# Every worktree of this repo, main checkout included.
while IFS= read -r WT; do
  [ -d "$WT" ] || continue

  DIRTY=$(git -C "$WT" status --porcelain 2>/dev/null | grep -vc '^$')
  if [ "${DIRTY:-0}" -gt 0 ]; then
    PROBLEMS="${PROBLEMS}  - ${WT}: ${DIRTY} uncommitted file(s)
"
  fi

  # A commit is safe when ANY origin ref can reach it. A local-only branch
  # name is fine if its commits already landed on origin/main — flagging
  # that is noise, and a noisy guard gets switched off.
  BRANCH=$(git -C "$WT" symbolic-ref --short HEAD 2>/dev/null)
  [ -n "$BRANCH" ] || continue
  HEAD_SHA=$(git -C "$WT" rev-parse HEAD 2>/dev/null) || continue
  if ! git -C "$WT" for-each-ref --format='%(refname)' refs/remotes/origin \
       --contains "$HEAD_SHA" 2>/dev/null | grep -q .; then
    if git -C "$WT" rev-parse --verify --quiet "origin/${BRANCH}" >/dev/null 2>&1; then
      AHEAD=$(git -C "$WT" rev-list --count "origin/${BRANCH}..HEAD" 2>/dev/null)
      PROBLEMS="${PROBLEMS}  - ${WT} (${BRANCH}): ${AHEAD} commit(s) not on GitHub
"
    else
      PROBLEMS="${PROBLEMS}  - ${WT} (${BRANCH}): branch is on this laptop only
"
    fi
  fi
done < <(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0,10)}')

[ -n "$(git stash list 2>/dev/null)" ] && PROBLEMS="${PROBLEMS}  - git stash is not empty
"

if [ -n "$PROBLEMS" ]; then
  {
    echo "UNPUSHED WORK — do not stop yet. GitHub does not have this:"
    printf '%s' "$PROBLEMS"
    echo "Fix each one, then stop:"
    echo "  git -C <path> add -A && git -C <path> commit -m 'WIP: <what>'"
    echo "  git -C <path> push        # first push on a new branch: push -u origin <branch>"
    echo "Pushing is NOT deploying. It is safe. Do not skip it."
  } >&2
  exit 2
fi
exit 0
