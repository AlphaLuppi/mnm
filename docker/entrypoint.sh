#!/bin/sh
# Fix ownership of /mnm volume (runs as root, then drops to mnm user)
chown -R mnm:mnm /mnm 2>/dev/null || true
# Ensure tsx is resolvable from /app (bun may not hoist it to root node_modules)
if [ ! -d /app/node_modules/tsx ] && [ -d /usr/local/lib/node_modules/tsx ]; then
  mkdir -p /app/node_modules
  ln -sf /usr/local/lib/node_modules/tsx /app/node_modules/tsx
fi

# Grant mnm user access to Docker socket (for container management)
if [ -S /var/run/docker.sock ]; then
  DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
  if getent group "$DOCKER_GID" > /dev/null 2>&1; then
    usermod -aG "$DOCKER_GID" mnm 2>/dev/null || true
  else
    groupadd -g "$DOCKER_GID" docker 2>/dev/null || true
    usermod -aG docker mnm 2>/dev/null || true
  fi
fi

exec gosu mnm node --import tsx/esm server/dist/index.js "$@"
