#!/bin/sh
# =============================================================================
# MnM container entrypoint
# =============================================================================
# - Fixes ownership of /mnm volume
# - Bootstraps `authenticated` mode secrets if MNM_STANDALONE=true and they're
#   not provided via env. Secrets are persisted to a host-mounted file so
#   they survive container restarts.
# - Hooks docker socket gid for sandbox provisioning
# - Drops to the unprivileged `mnm` user via gosu
# =============================================================================
set -e

MNM_HOME_DIR="${MNM_HOME:-/mnm}"
SECRETS_FILE="${MNM_HOME_DIR}/instances/${MNM_INSTANCE_ID:-default}/.secrets.env"

chown -R mnm:mnm "${MNM_HOME_DIR}" 2>/dev/null || true

if [ ! -d /app/node_modules/tsx ] && [ -d /usr/local/lib/node_modules/tsx ]; then
  mkdir -p /app/node_modules
  ln -sf /usr/local/lib/node_modules/tsx /app/node_modules/tsx
fi

# ---------------------------------------------------------------------------
# Standalone mode: auto-generate the secrets the authenticated mode needs.
# Persist them to ${SECRETS_FILE} on the volume so a restart reuses the same
# secret material (sessions, encrypted blobs stay valid).
# ---------------------------------------------------------------------------
if [ "${MNM_STANDALONE:-false}" = "true" ]; then
  mkdir -p "$(dirname "${SECRETS_FILE}")"

  if [ -f "${SECRETS_FILE}" ]; then
    # shellcheck disable=SC1090
    . "${SECRETS_FILE}"
  fi

  gen_secret() {
    # 32 random bytes hex-encoded — matches `openssl rand -hex 32`.
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  }

  NEED_WRITE=0
  for var in BETTER_AUTH_SECRET MNM_AGENT_JWT_SECRET MNM_MCP_JWT_SECRET MNM_SECRETS_KEY MNM_SECRETS_MASTER_KEY POSTGRES_PASSWORD; do
    eval "current=\${$var:-}"
    if [ -z "${current}" ]; then
      newval="$(gen_secret)"
      eval "export $var=\"${newval}\""
      NEED_WRITE=1
    fi
  done

  if [ "${NEED_WRITE}" = "1" ]; then
    {
      echo "# Auto-generated standalone secrets — DO NOT EDIT or share."
      echo "# Stored on the MNM_HOME volume; deleting this file rotates all keys"
      echo "# (existing sessions and encrypted blobs become unreadable)."
      printf 'BETTER_AUTH_SECRET=%s\n' "${BETTER_AUTH_SECRET}"
      printf 'MNM_AGENT_JWT_SECRET=%s\n' "${MNM_AGENT_JWT_SECRET}"
      printf 'MNM_MCP_JWT_SECRET=%s\n' "${MNM_MCP_JWT_SECRET}"
      printf 'MNM_SECRETS_KEY=%s\n' "${MNM_SECRETS_KEY}"
      printf 'MNM_SECRETS_MASTER_KEY=%s\n' "${MNM_SECRETS_MASTER_KEY}"
      printf 'POSTGRES_PASSWORD=%s\n' "${POSTGRES_PASSWORD}"
    } > "${SECRETS_FILE}"
    chmod 600 "${SECRETS_FILE}" 2>/dev/null || true
    chown mnm:mnm "${SECRETS_FILE}" 2>/dev/null || true
    echo "[entrypoint] Auto-generated standalone secrets at ${SECRETS_FILE}"
  fi
fi

if [ -S /var/run/docker.sock ]; then
  DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
  if getent group "$DOCKER_GID" > /dev/null 2>&1; then
    usermod -aG "$DOCKER_GID" mnm 2>/dev/null || true
  else
    groupadd -g "$DOCKER_GID" docker 2>/dev/null || true
    usermod -aG docker mnm 2>/dev/null || true
  fi
fi

exec gosu mnm env \
  BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-}" \
  MNM_AGENT_JWT_SECRET="${MNM_AGENT_JWT_SECRET:-}" \
  MNM_MCP_JWT_SECRET="${MNM_MCP_JWT_SECRET:-}" \
  MNM_SECRETS_KEY="${MNM_SECRETS_KEY:-}" \
  MNM_SECRETS_MASTER_KEY="${MNM_SECRETS_MASTER_KEY:-}" \
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}" \
  node --import tsx/esm server/dist/index.js "$@"
