#!/bin/bash -ex
export MNM_TEST_ROOT="$(mktemp -d /tmp/mnm-clean.XXXXXX)"
export MNM_HOME="$MNM_TEST_ROOT/home"
export MNM_CACHE="$MNM_TEST_ROOT/npm-cache"
export MNM_DATA="$MNM_TEST_ROOT/mnm-data"
mkdir -p "$MNM_HOME" "$MNM_CACHE" "$MNM_DATA"
echo "MNM_TEST_ROOT: $MNM_TEST_ROOT"
echo "MNM_HOME: $MNM_HOME"
cd $MNM_TEST_ROOT
git clone github.com:AlphaLuppi/mnm.git repo
cd repo
bun install
env HOME="$MNM_HOME" npm_config_cache="$MNM_CACHE" npm_config_userconfig="$MNM_HOME/.npmrc" \
  bun run mnm onboard --yes --data-dir "$MNM_DATA"