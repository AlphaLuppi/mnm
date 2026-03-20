#!/bin/sh
# Fix ownership of /mnm volume (runs as root, then drops to mnm user)
chown -R mnm:mnm /mnm 2>/dev/null || true
# Ensure tsx is resolvable from /app (bun may not hoist it to root node_modules)
if [ ! -d /app/node_modules/tsx ] && [ -d /usr/local/lib/node_modules/tsx ]; then
  mkdir -p /app/node_modules
  ln -sf /usr/local/lib/node_modules/tsx /app/node_modules/tsx
fi

exec gosu mnm node --import tsx/esm server/dist/index.js "$@"
