# ── Build stage ──────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ── Run stage ────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 mnm && \
    adduser --system --uid 1001 mnm

COPY --from=builder --chown=mnm:mnm /app/.next/standalone ./
COPY --from=builder --chown=mnm:mnm /app/.next/static ./.next/static
COPY --from=builder --chown=mnm:mnm /app/public ./public

USER mnm

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
