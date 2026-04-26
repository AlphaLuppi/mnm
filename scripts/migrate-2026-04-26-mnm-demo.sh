#!/usr/bin/env bash
# scripts/migrate-2026-04-26-mnm-demo.sh
#
# OPS-1a — M1 of docs/superpowers/plans/2026-04-26-mnm-git-first-agents.md
#
# Restructures lab.cbainfo.fr/tom.andrieu/mnm-workflows-tom into the
# Git-first agents layout, tags it (agents/v1.0.0, cba-feature-dev/v1.0.2),
# pushes it back, and renames the GitLab project to mnm-demo.
#
# Idempotent: every step probes for existing state first, so re-running the
# script after a partial failure is safe. Tom granted permission to rename +
# force-push on tom.andrieu/* repos. The script does NOT --force-push the
# branch by default — only tags receive --force when --force is passed.
#
# Usage:
#   GITLAB_TOKEN=glpat-... ./scripts/migrate-2026-04-26-mnm-demo.sh
#   GITLAB_TOKEN=glpat-... ./scripts/migrate-2026-04-26-mnm-demo.sh --force
#
# Requires: bash, git, curl, jq.
# Optional: glab CLI (used for the project rename if available).

set -euo pipefail

# ── Config (edit if your lab path differs) ──────────────────────────────────

GITLAB_HOST="${GITLAB_HOST:-lab.cbainfo.fr}"
GITLAB_NAMESPACE="${GITLAB_NAMESPACE:-tom.andrieu}"
SOURCE_REPO="${SOURCE_REPO:-mnm-workflows-tom}"
TARGET_REPO="${TARGET_REPO:-mnm-demo}"
BRANCH="${BRANCH:-main}"
AGENTS_TAG="${AGENTS_TAG:-agents/v1.0.0}"
WORKFLOW_TAG="${WORKFLOW_TAG:-cba-feature-dev/v1.0.2}"

FORCE_TAGS=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE_TAGS=1
fi

WORKDIR="$(mktemp -d -t mnm-demo-migrate-XXXXXX)"
trap 'rm -rf "$WORKDIR"' EXIT

cd "$WORKDIR"

# ── Helpers ─────────────────────────────────────────────────────────────────

log() { printf "[migrate-mnm-demo] %s\n" "$*"; }

# Move a file only if the source still exists. Idempotent re-runs become no-ops.
git_mv_safe() {
  local src="$1"
  local dst="$2"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    git mv "$src" "$dst"
    log "moved: $src -> $dst"
  else
    log "skip (already moved or absent): $src"
  fi
}

# Move a directory atomically.
git_mv_dir_safe() {
  local src="$1"
  local dst="$2"
  if [[ -d "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    git mv "$src" "$dst"
    log "moved dir: $src -> $dst"
  else
    log "skip (already moved or absent): $src/"
  fi
}

# ── Step 1: clone (try the new name first, fall back to the old name) ──────

log "cloning from https://$GITLAB_HOST/$GITLAB_NAMESPACE/..."
if git clone "https://$GITLAB_HOST/$GITLAB_NAMESPACE/$TARGET_REPO.git" "$TARGET_REPO" 2>/dev/null; then
  log "cloned existing $TARGET_REPO (rename already happened — running on the renamed repo)"
elif git clone "https://$GITLAB_HOST/$GITLAB_NAMESPACE/$SOURCE_REPO.git" "$TARGET_REPO"; then
  log "cloned $SOURCE_REPO into ./$TARGET_REPO (rename pending)"
else
  echo "ERROR: could not clone $SOURCE_REPO or $TARGET_REPO from $GITLAB_HOST/$GITLAB_NAMESPACE" >&2
  exit 1
fi

cd "$TARGET_REPO"
git checkout "$BRANCH"

# ── Step 2: detect whether the restructure already happened ────────────────

if [[ -f "agents/senior-dev/agent.md" && -f "workflows/cba-feature-dev/workflow.json" ]]; then
  log "restructure already applied (agents/<name>/agent.md + workflows/cba-feature-dev/ both present)"
  RESTRUCTURE_NEEDED=0
else
  RESTRUCTURE_NEEDED=1
fi

# ── Step 3: restructure ─────────────────────────────────────────────────────

if [[ "$RESTRUCTURE_NEEDED" -eq 1 ]]; then
  log "restructuring repo into agents/<name>/agent.md + workflows/<name>/* layout"

  mkdir -p agents workflows

  git_mv_safe "cba-feature-dev/agents/senior-dev.md"     "agents/senior-dev/agent.md"
  git_mv_safe "cba-feature-dev/agents/dev.md"            "agents/dev/agent.md"
  git_mv_safe "cba-feature-dev/agents/review-watcher.md" "agents/review-watcher/agent.md"
  git_mv_safe "cba-feature-dev/agents/release-mgr.md"    "agents/release-mgr/agent.md"

  # Move the rest of cba-feature-dev (workflow.json + gates/) under workflows/.
  if [[ -d "cba-feature-dev" ]]; then
    git_mv_dir_safe "cba-feature-dev" "workflows/cba-feature-dev"
  fi

  # Optional: same for product-feature-delivery if present.
  if [[ -d "product-feature-delivery" ]]; then
    git_mv_dir_safe "product-feature-delivery" "workflows/product-feature-delivery"
  fi

  # Only commit if there are staged changes.
  if ! git diff --cached --quiet; then
    git -c user.name="mnm-migrator" -c user.email="mnm-migrator@cbainfo.fr" \
      commit -m "refactor: restructure repo per Git-first agents convention

agents/<name>/agent.md (was: cba-feature-dev/agents/<name>.md)
workflows/<name>/{workflow.json,gates/*.gate.ts} (was: <name>/...)

Aligns with MnM 2026-04-26 spec
(docs/superpowers/specs/2026-04-26-mnm-git-first-agents-design.md)."
    log "committed restructure"
  else
    log "no staged changes — restructure was a no-op"
  fi
else
  log "skipping restructure step"
fi

# ── Step 4: push branch ────────────────────────────────────────────────────

log "pushing $BRANCH"
git push origin "$BRANCH"

# ── Step 5: tags (idempotent — only create if missing) ─────────────────────

create_or_update_tag() {
  local tag="$1"
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    if [[ "$FORCE_TAGS" -eq 1 ]]; then
      log "tag $tag exists — re-creating with --force (--force flag passed)"
      git tag -f "$tag"
      git push origin "$tag" --force
    else
      log "tag $tag already exists — skip (pass --force to overwrite)"
    fi
  else
    git tag "$tag"
    git push origin "$tag"
    log "tagged + pushed: $tag"
  fi
}

create_or_update_tag "$AGENTS_TAG"
create_or_update_tag "$WORKFLOW_TAG"

# ── Step 6: rename the GitLab project ──────────────────────────────────────

if [[ -z "${GITLAB_TOKEN:-}" ]]; then
  log "no GITLAB_TOKEN in env — skipping project rename. Rename via the GitLab UI or re-run with GITLAB_TOKEN set."
  exit 0
fi

# URL-encoded `namespace/source-repo`.
PROJECT_PATH_ENC=$(printf '%s' "$GITLAB_NAMESPACE/$SOURCE_REPO" | sed 's|/|%2F|g')

if command -v glab >/dev/null 2>&1; then
  log "renaming via glab (preferred)"
  if glab repo edit "$GITLAB_NAMESPACE/$SOURCE_REPO" --name "$TARGET_REPO" --path "$TARGET_REPO" 2>/dev/null; then
    log "renamed $SOURCE_REPO -> $TARGET_REPO via glab"
  else
    log "glab rename failed (project may already be named $TARGET_REPO) — verify manually"
  fi
else
  log "glab CLI not found — falling back to GitLab API (curl)"
  HTTP_STATUS=$(
    curl -s -o /tmp/mnm-rename-resp.json -w "%{http_code}" \
      --request PUT \
      --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
      --data "name=$TARGET_REPO" \
      --data "path=$TARGET_REPO" \
      "https://$GITLAB_HOST/api/v4/projects/$PROJECT_PATH_ENC"
  )
  case "$HTTP_STATUS" in
    200)
      log "renamed $SOURCE_REPO -> $TARGET_REPO (HTTP 200)" ;;
    404)
      log "source $SOURCE_REPO not found (likely already renamed to $TARGET_REPO) — skip" ;;
    *)
      log "rename request returned HTTP $HTTP_STATUS — inspect /tmp/mnm-rename-resp.json"
      cat /tmp/mnm-rename-resp.json >&2
      exit 1 ;;
  esac
fi

log "DONE — repo restructured, tagged, and renamed (or already in target state)"
