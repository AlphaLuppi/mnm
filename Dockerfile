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
  && apt-get install -y --no-install-recommends ca-certificates curl git unzip \
  && rm -rf /var/lib/apt/lists/*
# SEC-T10-003: Pin bun to a specific version and verify SHA256 checksum.
# DO NOT use curl|bash — that executes untrusted code without any verification.
# To update: change BUN_VERSION + the per-arch SHA256s below
# (from https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/SHASUMS256.txt).
ENV BUN_VERSION=1.2.10
ENV BUN_SHA256_X64=68a154ff1be96851b4d1a87cc5197f027ef80ab79afa3d4587150fae5c34c36e
ENV BUN_SHA256_AARCH64=54592fd0237e3ec91a2933dff015e15a78989d97234042e7d5334a4c0ad50603
RUN arch="$(uname -m)"; \
    case "$arch" in \
      x86_64)  BUN_ARCH="x64";     BUN_SHA256="$BUN_SHA256_X64" ;; \
      aarch64) BUN_ARCH="aarch64"; BUN_SHA256="$BUN_SHA256_AARCH64" ;; \
      *) echo "Unsupported arch: $arch" && exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-${BUN_ARCH}.zip" \
      -o /tmp/bun.zip \
    && echo "${BUN_SHA256}  /tmp/bun.zip" | sha256sum -c - \
    && unzip /tmp/bun.zip -d /tmp \
    && mv "/tmp/bun-linux-${BUN_ARCH}/bun" /usr/local/bin/bun \
    && chmod +x /usr/local/bin/bun \
    && rm -rf /tmp/bun.zip "/tmp/bun-linux-${BUN_ARCH}"
ENV PATH="/usr/local/bin:$PATH"

FROM base AS deps
WORKDIR /app
# Copy only package manifests + lock for optimal layer caching
COPY package.json bun.lock .npmrc ./
COPY cli/package.json cli/
COPY server/package.json server/
COPY ui/package.json ui/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapter-utils/package.json packages/adapter-utils/
COPY packages/execution-target/package.json packages/execution-target/
COPY packages/gate-runner/package.json packages/gate-runner/
COPY packages/git-provider/package.json packages/git-provider/
COPY packages/governed-workflows/package.json packages/governed-workflows/
COPY packages/isolate-runtime/package.json packages/isolate-runtime/
COPY packages/mnm-plugin/package.json packages/mnm-plugin/
COPY packages/test-utils/package.json packages/test-utils/
COPY packages/workflow-hooks/package.json packages/workflow-hooks/
COPY packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY packages/adapters/codex-local/package.json packages/adapters/codex-local/
COPY packages/adapters/cursor-local/package.json packages/adapters/cursor-local/
COPY packages/adapters/opencode-local/package.json packages/adapters/opencode-local/
COPY packages/adapters/pi-local/package.json packages/adapters/pi-local/

# Use BuildKit cache mount for bun cache to speed up CI builds
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN bun run --filter @mnm/ui build
RUN bun run --filter @mnm/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

FROM base AS production
WORKDIR /app
COPY --from=build /app /app
# tsx is needed at runtime because workspace packages (e.g. @mnm/db) export .ts files
RUN npm install --global tsx @anthropic-ai/claude-code@latest @openai/codex@latest opencode-ai

# Docker CLI (for docker exec into sandbox containers via /var/run/docker.sock)
RUN curl -fsSL https://download.docker.com/linux/static/stable/$(uname -m)/docker-27.5.1.tgz \
  | tar xz --strip-components=1 -C /usr/local/bin docker/docker

# Non-root user so Claude Code accepts --dangerously-skip-permissions
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/* \
  && groupadd -r mnm && useradd -r -g mnm -d /mnm -s /bin/bash mnm \
  && mkdir -p /mnm && chown -R mnm:mnm /mnm

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

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
