#!/usr/bin/env bash
#
# Self-running test + demo harness for the GeniusQA macOS automation version.
#
# Runs the green, automation-core test suites and the end-to-end self-running
# demo. Intentionally scopes to the subsystems that power the macOS automation
# loop (OCR / vision / playback / scripting / permissions) — it does NOT run the
# desktop "react" (jsdom UI) project or the rust "visual_testing" module, both of
# which have known pre-existing failures tracked separately.
#
# Usage:
#   ./scripts/run-macos-automation-tests.sh            # tests + safe demo
#   ./scripts/run-macos-automation-tests.sh --no-rust  # skip slow rust suite
#   ./scripts/run-macos-automation-tests.sh --demo-only
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_RUST=1
DEMO_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --no-rust)   RUN_RUST=0 ;;
    --demo-only) DEMO_ONLY=1 ;;
    *) echo "Unknown arg: $arg"; exit 2 ;;
  esac
done

# Ensure Node 22 for the desktop jest suites (machine default may be older).
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || true
fi

fail=0
section() { printf '\n========== %s ==========\n' "$1"; }

if [ "$DEMO_ONLY" -eq 0 ]; then
  section "Python core (vision / OCR / player / recorder / storage)"
  ( cd "$ROOT/packages/python-core" && python3 -m pytest src/ -q -p no:cacheprovider ) || fail=1

  section "Desktop services + utils (automation services)"
  ( cd "$ROOT/packages/desktop" && npx jest --selectProjects services utils ) || fail=1

  if [ "$RUN_RUST" -eq 1 ]; then
    section "Rust core (playback / permissions / preferences / integration)"
    # Exclude the visual_testing module (tracked separately).
    ( cd "$ROOT/packages/rust-core" && cargo test --lib -- --skip visual_testing ) || fail=1
  fi
fi

section "End-to-end self-running macOS automation demo (safe mode)"
( cd "$ROOT/packages/python-core" && python3 examples/self_running_macos_demo.py ) || fail=1

section "Result"
if [ "$fail" -eq 0 ]; then
  echo "ALL AUTOMATION-CORE CHECKS PASSED"
else
  echo "SOME CHECKS FAILED (exit 1)"
fi
exit "$fail"
