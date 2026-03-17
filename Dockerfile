# tech-08-dockerfile-optimized
# =============================================================================
# MnM — Multi-stage Dockerfile (CI/CD optimized)
# =============================================================================
# Build stages: base -> deps -> build -> production
# Optimized for Docker layer caching and BuildKit cache mounts.
# Story: TECH-08 — CI/CD Pipeline
# =============================================================================
# syntax=docker/dockerfile:1

FROM node:lts-trixie-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS deps
WORKDIR /app
# Copy only package manifests first for optimal layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY cli/package.json cli/
COPY server/package.json server/
COPY ui/package.json ui/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapter-utils/package.json packages/adapter-utils/
COPY packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY packages/adapters/codex-local/package.json packages/adapters/codex-local/
COPY packages/adapters/cursor-local/package.json packages/adapters/cursor-local/
COPY packages/adapters/openclaw-gateway/package.json packages/adapters/openclaw-gateway/
COPY packages/adapters/opencode-local/package.json packages/adapters/opencode-local/
COPY packages/adapters/pi-local/package.json packages/adapters/pi-local/

# Use BuildKit cache mount for pnpm store to speed up CI builds
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter @mnm/ui build
RUN pnpm --filter @mnm/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

FROM base AS production
WORKDIR /app
COPY --from=build /app /app
RUN npm install --global --omit=dev @anthropic-ai/claude-code@latest @openai/codex@latest opencode-ai

# Non-root user so Claude Code accepts --dangerously-skip-permissions
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/* \
  && groupadd -r mnm && useradd -r -g mnm -d /mnm -s /bin/bash mnm \
  && mkdir -p /mnm && chown -R mnm:mnm /mnm

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production \
  HOME=/mnm \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  MNM_HOME=/mnm \
  MNM_INSTANCE_ID=default \
  MNM_CONFIG=/mnm/instances/default/config.json \
  MNM_DEPLOYMENT_MODE=authenticated \
  MNM_DEPLOYMENT_EXPOSURE=private

VOLUME ["/mnm"]
EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3100/api/health || exit 1

ENTRYPOINT ["entrypoint.sh"]
