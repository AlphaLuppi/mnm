#!/usr/bin/env bash
#
# Generate Software Bill of Materials (SBOM) artifacts for MnM.
#
# Outputs (in ./sbom/):
#   - sbom-app.cdx.json       CycloneDX SBOM of the bun workspace dependency tree
#   - sbom-docker.cdx.json    CycloneDX SBOM of the built mnm-server Docker image (if present)
#   - sbom-docker.spdx.json   SPDX SBOM of the same image
#   - sbom-github.spdx.json   GitHub Dependency Graph SBOM (only if repo is public)
#
# Tools required (install on demand):
#   - bun + bunx     (already required for MnM dev)
#   - syft           https://github.com/anchore/syft  (Docker SBOM)
#   - gh             GitHub CLI                       (GitHub-native SBOM)
#
# Usage:
#   bun run sbom                # generate everything available
#   bun run sbom -- --app-only  # skip Docker + GitHub steps
#
# Exit codes:
#   0  success (all available SBOMs generated)
#   1  hard failure (cdxgen for the app SBOM is mandatory)
#   2  partial success (app SBOM ok, but Docker or GitHub step skipped/failed)

set -euo pipefail

# Resolve repo root regardless of where the script is called from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

OUT_DIR="$REPO_ROOT/sbom"
mkdir -p "$OUT_DIR"

APP_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --app-only) APP_ONLY=true ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

partial_failure=false

# ---------------------------------------------------------------------------
# 1. App SBOM (bun workspace) — mandatory
# ---------------------------------------------------------------------------
echo "==> [1/3] Generating app SBOM via @cyclonedx/cdxgen (bun workspace)…"
if ! bunx --bun @cyclonedx/cdxgen \
        -t bun \
        -o "$OUT_DIR/sbom-app.cdx.json" \
        --spec-version 1.5 \
        --no-recurse \
        "$REPO_ROOT"; then
  echo "ERROR: cdxgen failed. The app SBOM is mandatory — aborting." >&2
  exit 1
fi
echo "    -> $OUT_DIR/sbom-app.cdx.json"

# ---------------------------------------------------------------------------
# 2. Docker image SBOM — best effort
# ---------------------------------------------------------------------------
if [ "$APP_ONLY" = "true" ]; then
  echo "==> [2/3] Skipped (--app-only)."
else
  echo "==> [2/3] Generating Docker image SBOM via syft…"
  if ! command -v syft >/dev/null 2>&1; then
    echo "    syft not installed — skipping. Install: https://github.com/anchore/syft" >&2
    partial_failure=true
  elif ! docker image inspect mnm-server:latest >/dev/null 2>&1; then
    echo "    Docker image 'mnm-server:latest' not found — skipping." >&2
    echo "    Build it first with: docker compose build server" >&2
    partial_failure=true
  else
    syft "mnm-server:latest" -o "cyclonedx-json=$OUT_DIR/sbom-docker.cdx.json"
    syft "mnm-server:latest" -o "spdx-json=$OUT_DIR/sbom-docker.spdx.json"
    echo "    -> $OUT_DIR/sbom-docker.cdx.json"
    echo "    -> $OUT_DIR/sbom-docker.spdx.json"
  fi
fi

# ---------------------------------------------------------------------------
# 3. GitHub-native SBOM — only when repo is public
# ---------------------------------------------------------------------------
if [ "$APP_ONLY" = "true" ]; then
  echo "==> [3/3] Skipped (--app-only)."
else
  echo "==> [3/3] Fetching GitHub Dependency Graph SBOM…"
  if ! command -v gh >/dev/null 2>&1; then
    echo "    gh CLI not installed — skipping. Install: https://cli.github.com/" >&2
    partial_failure=true
  else
    visibility="$(gh repo view AlphaLuppi/mnm --json visibility -q .visibility 2>/dev/null || echo "unknown")"
    if [ "$visibility" != "PUBLIC" ]; then
      echo "    Repo visibility is '$visibility' — Dependency Graph SBOM only available on public repos. Skipping." >&2
      partial_failure=true
    else
      gh api -H "Accept: application/vnd.github+json" \
        "/repos/AlphaLuppi/mnm/dependency-graph/sbom" \
        > "$OUT_DIR/sbom-github.spdx.json"
      echo "    -> $OUT_DIR/sbom-github.spdx.json"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
echo "==> SBOM artifacts:"
ls -lh "$OUT_DIR" | awk 'NR>1 {print "    "$NF" ("$5")"}'

if [ "$partial_failure" = "true" ]; then
  echo
  echo "Partial success: some optional steps were skipped (see messages above)." >&2
  exit 2
fi

echo
echo "Done."
