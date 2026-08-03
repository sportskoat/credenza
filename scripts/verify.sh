#!/usr/bin/env bash
# Credenza verification harness.
# Runs every binary gate for the overnight build.
# Usage: scripts/verify.sh [test|lint|typecheck|build|all]
# Default is "all". Exit code 0 means every gate passed.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREVIEW="$REPO_ROOT/preview"
WHICH="${1:-all}"
FAILED=()

run_gate() {
  local name="$1"; shift
  echo ""
  echo "=== GATE: $name ==="
  if (cd "$PREVIEW" && "$@"); then
    echo "--- PASS: $name"
  else
    echo "--- FAIL: $name"
    FAILED+=("$name")
  fi
}

case "$WHICH" in
  test)      run_gate test npm run test ;;
  lint)      run_gate lint npm run lint ;;
  typecheck) run_gate typecheck npm run typecheck ;;
  build)     run_gate build npm run build ;;
  all)
    run_gate test npm run test
    run_gate lint npm run lint
    run_gate typecheck npm run typecheck
    run_gate build npm run build
    ;;
  *)
    echo "Unknown gate: $WHICH" >&2
    exit 2
    ;;
esac

echo ""
echo "=================================="
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "VERIFY: ALL GATES PASSED"
  exit 0
fi
echo "VERIFY: FAILED GATES -> ${FAILED[*]}"
exit 1
