#!/bin/sh
# Fix ownership of /mnm volume (runs as root, then drops to mnm user)
chown -R mnm:mnm /mnm 2>/dev/null || true
exec gosu mnm node --import tsx/esm server/dist/index.js "$@"
