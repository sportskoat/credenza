#!/bin/bash
# SessionStart hook — runs on start, /clear, and after compaction, so a fresh
# (or freshly-compacted) context always gets pointed at the black box first.
echo "Credenza protocol: read docs/session-state.md FIRST (living checkpoint: state, decisions, build order). Read docs/Monetization.md before feature work and docs/carousel-canonical-state.md before touching the carousel. Keep session-state.md current; /compact manually at ~60% context — auto-compact is unreliable under this proxy setup."
