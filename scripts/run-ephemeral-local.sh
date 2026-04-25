#!/usr/bin/env bash
set -euo pipefail

PROJECT_SLUG="flux-one"
ENV_PROFILE="${1:-sandbox-clean}"
HARNESS_DIR="${FLUX_EPHEMERAL_HARNESS_DIR:-/home/edaniels/repos/wp-local/ephemeral-wp-test}"

if [[ ! -x "$HARNESS_DIR/scripts/test-project.sh" ]]; then
  echo "Ephemeral harness missing: $HARNESS_DIR/scripts/test-project.sh" >&2
  exit 1
fi

cd "$HARNESS_DIR"
bash scripts/test-project.sh "$PROJECT_SLUG" "$ENV_PROFILE"

LATEST_RESULT="$(ls -1dt /home/edaniels/repos/logs/flux-ephemeral/${PROJECT_SLUG}/*_${PROJECT_SLUG}_${ENV_PROFILE}/result.json 2>/dev/null | head -n1 || true)"
if [[ -n "$LATEST_RESULT" ]]; then
  echo "Result: $LATEST_RESULT"
fi
