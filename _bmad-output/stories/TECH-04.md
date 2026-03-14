# TECH-04 : Redis Setup — Spécification Détaillée

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Story ID** | TECH-04 |
| **Titre** | Redis Setup |
| **Epic** | Epic 0 — Infrastructure & Setup |
| **Sprint** | Sprint 0 (prérequis) |
| **Effort** | M (3 SP, 2-3j) |
| **Assignation** | Tom (backend) |
| **Bloqué par** | TECH-02 (Docker Compose — DONE) |
| **Débloque** | CHAT-S01 (WebSocket bidirectionnel), OBS-S03 (Résumé LLM cache), performance features |
| **ADR** | ADR lié à architecture-b2b.md section 8.2 (Redis strategy) |
| **Type** | Backend-only (pas de composant UI) |

---

## Description

### Objectif

Intégrer un client Redis dans le serveur MnM pour poser les fondations des fonctionnalités B2B qui dépendent de Redis : sessions, cache, WebSocket pub/sub (scaling multi-instance), et rate limiting. Cette story installe le client, le rate limiting API, et l'enrichissement du health check. Les usages avancés (sessions Redis, pub/sub, cache queries) seront implémentés dans les stories ultérieures.

### Ce qui a changé depuis l'écriture de l'epic

L'epic originale décrit TECH-04 comme "Redis pour sessions, cache, WebSocket pub/sub, rate limiting. docker-compose service + client Redis dans le serveur." Depuis :

1. **TECH-02 est terminé** — L'infrastructure Docker est en place :
   - `docker-compose.dev.yml` a Redis 7-alpine sur port `${REDIS_PORT:-6379}` avec volume `redisdata-dev`
   - `docker-compose.test.yml` a Redis sur port 6380 avec `tmpfs`
   - `docker-compose.yml` (prod) a Redis sans port exposé, accessible via `redis://redis:6379`
   - `.env.example` documente déjà `REDIS_URL=redis://127.0.0.1:6379` (commenté)

2. **Aucun code Redis n'existe dans le serveur** — Pas de dépendance `ioredis` dans `server/package.json`, pas de module client, pas de middleware rate limiting.

3. **Le health check existe déjà** (`server/src/routes/health.ts`) — Il vérifie la connectivité PostgreSQL (latence, version) et retourne `status: "ok"` ou `status: "degraded"`. Il faut ajouter le statut Redis.

4. **L'architecture B2B prévoit Redis pour 4 usages** (architecture-b2b.md, section 8.2) :
   - Sessions (Better Auth session store)
   - Query cache avec préfixe multi-tenant `tenant:{companyId}:`
   - WebSocket pub/sub pour scaling multi-instance
   - Rate limiting (5 niveaux définis en section 6.5)

5. **Le rate limiting de l'architecture prévoit 4 niveaux** (architecture-b2b.md, section 6.5) :
   - Login: 5 req/1 min
   - Invitations: 20 req/1 h
   - Chat messages: 10 req/1 min
   - API général: 100 req/1 min

### Scope ajusté

Étant donné l'état actuel, TECH-04 doit :

1. **Installer `ioredis`** comme dépendance du package `server`
2. **Créer un module client Redis** (`server/src/redis.ts`) avec connexion optionnelle et graceful degradation
3. **Ajouter `redisUrl` à la config** (`server/src/config.ts`)
4. **Enrichir le health check** avec le statut Redis (connecté, latence)
5. **Créer un middleware rate limiting** (`server/src/middleware/rate-limit.ts`) avec fallback in-memory quand Redis est indisponible
6. **Appliquer le rate limiting API général** (100 req/min par IP) sur les routes API
7. **Préparer les exports** pour les futurs usages (pub/sub, cache) sans les implémenter

Ce que TECH-04 ne fait PAS :
- Migrer les sessions Better Auth vers Redis (story future)
- Implémenter le pub/sub WebSocket (CHAT-S01)
- Implémenter le cache de queries (story future)
- Implémenter le cache multi-tenant avec préfixe (story future)

---

## État Actuel du Code (Analyse)

### Fichiers clés

| Fichier | Rôle | État |
|---------|------|------|
| `server/package.json` | Dépendances serveur | Pas de `ioredis` |
| `server/src/config.ts` | Configuration serveur (loadConfig) | Pas de `redisUrl` |
| `server/src/index.ts` | Startup serveur | Pas d'init Redis |
| `server/src/app.ts` | Express app creation | Pas de rate limiting middleware |
| `server/src/routes/health.ts` | GET /api/health | Vérifie DB, pas Redis |
| `server/src/middleware/index.ts` | Barrel export middlewares | 3 exports (logger, errorHandler, validate) |
| `docker-compose.dev.yml` | Compose dev | Redis 7-alpine prêt (port 6379) |
| `docker-compose.test.yml` | Compose test | Redis sur port 6380 |
| `.env.example` | Template variables env | `REDIS_URL` documenté (commenté) |

### Constats

1. **`ioredis` est le standard Node.js** — Auto-reconnect, pipeline, pub/sub, Lua scripting. Préféré à `redis` (node-redis) pour la maturité et les features.

2. **Le pattern de graceful degradation existe déjà** — Le health check gère déjà le cas DB déconnectée (`status: "degraded"`). On applique le même pattern pour Redis.

3. **Express 5 est utilisé** — Le middleware rate limiting doit être compatible Express 5 (pas de `app.use(fn)` breaking changes, mais les types ont changé).

4. **L'app.ts monte les routes API sous `/api`** — Le rate limiting API général doit s'appliquer à toutes les routes sous `/api`.

5. **Le startup banner (`printStartupBanner`)** affiche déjà les infos DB et heartbeat — Il faudra potentiellement ajouter le statut Redis, mais cette modification cosmétique est optionnelle et hors scope strict.

---

## Tâches d'Implémentation

### T1 : Installer `ioredis` dans le package serveur

Ajouter `ioredis` comme dépendance de production et `@types/ioredis` comme dépendance de développement dans `server/package.json`.

**Fichier** : `server/package.json` (modification)

```bash
cd server && pnpm add ioredis
```

**Note** : `ioredis` fournit ses propres types TypeScript (fichier `.d.ts` intégré), donc `@types/ioredis` n'est pas nécessaire (il est d'ailleurs déprécié).

### T2 : Ajouter `redisUrl` à la configuration serveur

Ajouter le champ `redisUrl` à l'interface `Config` et le résoudre dans `loadConfig()`.

**Fichier** : `server/src/config.ts` (modification)

Ajouts :

1. Dans l'interface `Config` :
```typescript
export interface Config {
  // ... existing fields ...
  redisUrl: string | undefined;
}
```

2. Dans `loadConfig()`, avant le `return` :
```typescript
const redisUrl = process.env.REDIS_URL?.trim() || undefined;
```

3. Dans l'objet retourné :
```typescript
return {
  // ... existing fields ...
  redisUrl,
};
```

**Priorité des sources** : Variable d'environnement `REDIS_URL` uniquement. Pas de fichier de config pour Redis (cohérent avec l'approche 12-factor).

### T3 : Créer le module client Redis

Créer un module Redis client avec les caractéristiques suivantes :
- Connexion optionnelle (ne bloque pas le démarrage si Redis est indisponible)
- Auto-reconnect via ioredis (comportement par défaut)
- Logging des événements de connexion (connect, error, reconnecting, close)
- Export d'une fonction `createRedisClient()` et de helpers pour vérifier l'état
- Graceful shutdown (disconnect on process exit)

**Fichier** : `server/src/redis.ts` (nouveau)

```typescript
import Redis from "ioredis";
import { logger as parentLogger } from "./middleware/logger.js";

const logger = parentLogger.child({ module: "redis" });

export type RedisClient = Redis;

export interface RedisState {
  client: RedisClient | null;
  connected: boolean;
}

/**
 * Create a Redis client from a connection URL.
 * Returns null if no URL is provided (Redis is optional).
 *
 * The client auto-reconnects on disconnection (ioredis default).
 * Connection errors are logged but do NOT crash the process.
 */
export function createRedisClient(redisUrl: string | undefined): RedisState {
  if (!redisUrl) {
    logger.info("No REDIS_URL configured — Redis features disabled (rate limiting will use in-memory fallback)");
    return { client: null, connected: false };
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,     // never reject commands due to retries (queue them)
    enableReadyCheck: true,         // wait for READY before marking as connected
    retryStrategy(times: number) {
      // Exponential backoff: 50ms, 100ms, 200ms, ..., capped at 5s
      const delay = Math.min(times * 50, 5000);
      logger.warn({ attempt: times, nextRetryMs: delay }, "Redis reconnecting");
      return delay;
    },
    lazyConnect: false,
  });

  const state: RedisState = { client, connected: false };

  client.on("connect", () => {
    logger.info("Redis connected");
    state.connected = true;
  });

  client.on("ready", () => {
    logger.info("Redis ready");
    state.connected = true;
  });

  client.on("error", (err) => {
    logger.error({ err: err.message }, "Redis error");
    state.connected = false;
  });

  client.on("close", () => {
    logger.warn("Redis connection closed");
    state.connected = false;
  });

  client.on("reconnecting", (delay: number) => {
    logger.info({ delayMs: delay }, "Redis reconnecting");
  });

  return state;
}

/**
 * Ping Redis and return latency in milliseconds.
 * Returns null if Redis is not connected.
 */
export async function pingRedis(state: RedisState): Promise<{ connected: boolean; latencyMs?: number }> {
  if (!state.client || !state.connected) {
    return { connected: false };
  }

  try {
    const start = performance.now();
    await state.client.ping();
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return { connected: true, latencyMs };
  } catch {
    return { connected: false };
  }
}

/**
 * Gracefully disconnect Redis client.
 */
export async function disconnectRedis(state: RedisState): Promise<void> {
  if (state.client) {
    try {
      await state.client.quit();
    } catch {
      state.client.disconnect();
    }
    state.connected = false;
  }
}
```

**Design decisions** :
- `maxRetriesPerRequest: null` — ioredis queues commands during reconnection instead of rejecting them. This prevents transient errors during brief Redis outages.
- `retryStrategy` with exponential backoff — prevents hammering a down Redis instance.
- `lazyConnect: false` — connects immediately at startup to surface configuration errors early.
- `RedisState` object — a mutable reference that tracks connection status, passed to middleware and health check.

### T4 : Initialiser Redis au démarrage du serveur

Modifier `server/src/index.ts` pour :
1. Importer et créer le client Redis après le chargement de la config
2. Passer l'état Redis à `createApp()` pour le rate limiting et le health check
3. Disconnect Redis au shutdown

**Fichier** : `server/src/index.ts` (modification)

Ajouts :

1. Import en haut du fichier :
```typescript
import { createRedisClient, disconnectRedis, type RedisState } from "./redis.js";
```

2. Après `const config = loadConfig();` (vers ligne 60), créer le client :
```typescript
const redisState = createRedisClient(config.redisUrl);
```

3. Passer `redisState` à `createApp()` via les options :
```typescript
const app = await createApp(db as any, {
  // ... existing options ...
  redisState,
});
```

4. Dans le shutdown handler (vers ligne 640), ajouter la déconnexion Redis :
```typescript
await disconnectRedis(redisState);
```

### T5 : Enrichir le health check avec le statut Redis

Modifier `server/src/routes/health.ts` pour inclure le statut Redis dans la réponse.

**Fichier** : `server/src/routes/health.ts` (modification)

Ajouts :

1. Importer `pingRedis` et `RedisState` :
```typescript
import { pingRedis, type RedisState } from "../redis.js";
```

2. Ajouter `redisState` aux options de `healthRoutes()` :
```typescript
export function healthRoutes(
  db?: Db,
  opts: {
    // ... existing options ...
    redisState?: RedisState;
  } = {
    // ... existing defaults ...
  },
) {
```

3. Dans le handler GET `/`, après la vérification DB, ajouter :
```typescript
let redisStatus: { connected: boolean; latencyMs?: number; configured: boolean } = {
  connected: false,
  configured: false,
};

if (opts.redisState) {
  redisStatus.configured = true;
  const redisPing = await pingRedis(opts.redisState);
  redisStatus.connected = redisPing.connected;
  redisStatus.latencyMs = redisPing.latencyMs;
}
```

4. Inclure `redis` dans la réponse JSON :
```json
{
  "status": "ok",
  "db": { "connected": true, "latencyMs": 1.23, "version": "17.x" },
  "redis": { "connected": true, "latencyMs": 0.45, "configured": true },
  "deploymentMode": "local_trusted",
  "deploymentExposure": "private",
  "authReady": true,
  "bootstrapStatus": "ready",
  "features": { "companyDeletionEnabled": true }
}
```

**Important** : Redis non connecté NE DOIT PAS rendre le status `"degraded"`. Redis est optionnel. Seul DB déconnecté donne `"degraded"`. Redis est informatif uniquement.

### T6 : Créer le middleware de rate limiting

Créer un middleware Express de rate limiting qui utilise Redis quand disponible, avec fallback sur un store en mémoire.

**Fichier** : `server/src/middleware/rate-limit.ts` (nouveau)

```typescript
import type { Request, Response, NextFunction } from "express";
import type { RedisState } from "../redis.js";
import { logger as parentLogger } from "./logger.js";

const logger = parentLogger.child({ module: "rate-limit" });

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Key extractor: returns the rate limit key for a request (default: IP) */
  keyExtractor?: (req: Request) => string;
  /** Optional prefix for Redis keys */
  keyPrefix?: string;
}

/**
 * In-memory rate limit store (fallback when Redis is unavailable).
 * Uses a Map with periodic cleanup of expired entries.
 */
class InMemoryRateLimitStore {
  private counters = new Map<string, { count: number; resetAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup expired entries every 60s
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    // Ensure the timer doesn't prevent Node.js from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  async check(key: string, maxRequests: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const entry = this.counters.get(key);

    if (!entry || now >= entry.resetAt) {
      // New window
      const resetAt = now + windowSeconds * 1000;
      this.counters.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    entry.count += 1;
    const remaining = Math.max(0, maxRequests - entry.count);
    return {
      allowed: entry.count <= maxRequests,
      remaining,
      resetAt: entry.resetAt,
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.counters) {
      if (now >= entry.resetAt) {
        this.counters.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupTimer);
    this.counters.clear();
  }
}

/**
 * Redis-backed rate limit store using the sliding window counter pattern.
 * Uses a single Redis key per (prefix:IP) with INCR + EXPIRE.
 */
async function checkRedisRateLimit(
  redis: RedisState,
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number } | null> {
  if (!redis.client || !redis.connected) {
    return null; // Redis unavailable, caller should use fallback
  }

  try {
    const multi = redis.client.multi();
    multi.incr(key);
    multi.ttl(key);
    const results = await multi.exec();

    if (!results) return null;

    const currentCount = results[0]?.[1] as number;
    const ttl = results[1]?.[1] as number;

    // If TTL is -1, key exists but has no expiry — set it
    if (ttl === -1 || ttl === -2) {
      await redis.client.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, maxRequests - currentCount);
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowSeconds * 1000);

    return {
      allowed: currentCount <= maxRequests,
      remaining,
      resetAt,
    };
  } catch (err) {
    logger.warn({ err }, "Redis rate limit check failed, falling back to in-memory");
    return null; // Fallback to in-memory
  }
}

const defaultKeyExtractor = (req: Request): string => {
  // Use X-Forwarded-For if behind a proxy, otherwise use socket IP
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() || req.ip || "unknown";
  }
  return req.ip || "unknown";
};

/**
 * Create a rate limiting middleware.
 *
 * When Redis is available, uses Redis INCR+EXPIRE for distributed rate limiting.
 * When Redis is unavailable, falls back to an in-memory counter (single-instance only).
 *
 * Sets standard rate limit headers:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 * - Retry-After (on 429 only)
 */
export function createRateLimiter(
  redisState: RedisState | undefined,
  config: RateLimitConfig,
) {
  const {
    maxRequests,
    windowSeconds,
    keyExtractor = defaultKeyExtractor,
    keyPrefix = "rl",
  } = config;

  const memoryStore = new InMemoryRateLimitStore();
  let warnedAboutFallback = false;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const clientKey = keyExtractor(req);
    const redisKey = `${keyPrefix}:${clientKey}`;

    let result: { allowed: boolean; remaining: number; resetAt: number };

    // Try Redis first
    if (redisState?.client && redisState.connected) {
      const redisResult = await checkRedisRateLimit(redisState, redisKey, maxRequests, windowSeconds);
      if (redisResult) {
        result = redisResult;
      } else {
        // Redis failed, use in-memory fallback
        result = await memoryStore.check(clientKey, maxRequests, windowSeconds);
      }
      warnedAboutFallback = false;
    } else {
      // Redis not configured or not connected — use in-memory fallback
      if (!warnedAboutFallback && redisState?.client) {
        logger.warn("Redis unavailable for rate limiting — using in-memory fallback");
        warnedAboutFallback = true;
      }
      result = await memoryStore.check(clientKey, maxRequests, windowSeconds);
    }

    // Set rate limit headers
    const resetSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      res.setHeader("Retry-After", resetSeconds);
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowSeconds}s. Try again in ${resetSeconds}s.`,
        retryAfter: resetSeconds,
      });
      return;
    }

    next();
  };
}
```

**Design decisions** :
- **Fixed window counter** (INCR + EXPIRE) — simple et adapté au MVP. Sliding window log peut être ajouté plus tard si nécessaire.
- **In-memory fallback** — `InMemoryRateLimitStore` avec cleanup périodique. Fonctionne pour le single-instance dev mode. Ne fonctionne pas pour le multi-instance (c'est attendu — Redis est requis en prod multi-instance).
- **Standard headers** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Unix timestamp en secondes), `Retry-After` (secondes, uniquement sur 429).
- **`keyExtractor`** — Configurable pour les futures limites par endpoint (login, invitations, chat). Par défaut, rate limit par IP.
- **No `express-rate-limit` dependency** — On écrit le middleware nous-mêmes pour contrôler le fallback Redis/in-memory et éviter une dépendance supplémentaire.

### T7 : Appliquer le rate limiting sur les routes API

Modifier `server/src/app.ts` pour appliquer le rate limiting API général (100 req/min par IP) sur toutes les routes `/api`.

**Fichier** : `server/src/app.ts` (modification)

Ajouts :

1. Importer `createRateLimiter` et `RedisState` :
```typescript
import { createRateLimiter } from "./middleware/rate-limit.js";
import type { RedisState } from "./redis.js";
```

2. Ajouter `redisState` aux options de `createApp()` :
```typescript
export async function createApp(
  db: Db,
  opts: {
    // ... existing options ...
    redisState?: RedisState;
  },
) {
```

3. Après les middlewares existants (httpLogger, privateHostnameGuard, actorMiddleware), avant le montage des routes `/api`, ajouter le rate limiter sur le router API :
```typescript
const apiRateLimiter = createRateLimiter(opts.redisState, {
  maxRequests: 100,
  windowSeconds: 60,
  keyPrefix: "rl:api",
});
api.use(apiRateLimiter);
```

**Placement** : Le rate limiter est appliqué sur le router `api` (créé avec `Router()`) AVANT les routes métier, mais APRÈS l'auth middleware. Cela signifie :
- Les routes `/api/auth/*` (Better Auth) ne sont PAS rate-limitées par ce middleware (elles sont montées directement sur `app`, pas sur `api`)
- Le health check `/api/health` EST rate-limité (acceptable car 100/min est généreux)
- Les futures routes spécifiques (login, invitations) auront leur propre rate limiter plus restrictif

### T8 : Exporter le middleware rate-limit dans le barrel

Ajouter l'export du rate-limit middleware dans `server/src/middleware/index.ts`.

**Fichier** : `server/src/middleware/index.ts` (modification)

```typescript
export { logger, httpLogger } from "./logger.js";
export { errorHandler } from "./error-handler.js";
export { validate } from "./validate.js";
export { createRateLimiter } from "./rate-limit.js";
```

---

## Acceptance Criteria

### AC-1 : Client Redis se connecte au démarrage
```
Given le serveur MnM avec REDIS_URL=redis://127.0.0.1:6379 configuré
  And Redis 7 en cours d'exécution (via docker-compose.dev.yml)
When le serveur démarre
Then le log affiche "Redis connected" et "Redis ready"
  And aucune erreur Redis n'est loguée
  And le serveur démarre normalement
```

### AC-2 : Démarrage sans Redis (graceful degradation)
```
Given le serveur MnM SANS REDIS_URL configuré
  Or REDIS_URL configuré mais Redis non démarré
When le serveur démarre
Then le log affiche "No REDIS_URL configured — Redis features disabled" (si pas de REDIS_URL)
  Or le log affiche "Redis error" suivi de "Redis reconnecting" (si Redis down)
  And le serveur démarre normalement malgré l'absence de Redis
  And les routes API fonctionnent (rate limiting utilise le fallback in-memory)
```

### AC-3 : Health check inclut le statut Redis (connecté)
```
Given le serveur MnM démarré avec Redis connecté
When un client appelle GET /api/health
Then la réponse JSON inclut :
  - redis.connected: true
  - redis.latencyMs: <number> (ex: 0.45)
  - redis.configured: true
  And le status global reste "ok" (Redis ne détermine pas le status global)
```

**data-testid associés** :
- Endpoint: `GET /api/health`
- Champ réponse: `redis.connected`, `redis.latencyMs`, `redis.configured`

### AC-4 : Health check inclut le statut Redis (non configuré)
```
Given le serveur MnM démarré SANS REDIS_URL
When un client appelle GET /api/health
Then la réponse JSON inclut :
  - redis.connected: false
  - redis.configured: false
  And redis.latencyMs est absent
  And le status global reste "ok"
```

### AC-5 : Health check inclut le statut Redis (configuré mais déconnecté)
```
Given le serveur MnM démarré avec REDIS_URL configuré
  And Redis est arrêté après le démarrage
When un client appelle GET /api/health
Then la réponse JSON inclut :
  - redis.connected: false
  - redis.configured: true
  And redis.latencyMs est absent
  And le status global reste "ok" (pas "degraded" — Redis est optionnel)
```

### AC-6 : Rate limiting API — sous la limite
```
Given le serveur MnM démarré (avec ou sans Redis)
When un client envoie 50 requêtes GET /api/health en 60 secondes depuis la même IP
Then toutes les réponses ont le status 200
  And chaque réponse contient les headers :
    - X-RateLimit-Limit: 100
    - X-RateLimit-Remaining: <décroissant de 99 à 50>
    - X-RateLimit-Reset: <unix timestamp en secondes>
```

**data-testid associés** :
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### AC-7 : Rate limiting API — au-dessus de la limite
```
Given le serveur MnM démarré (avec ou sans Redis)
When un client dépasse 100 requêtes en 60 secondes depuis la même IP
Then la 101ème requête reçoit un status HTTP 429
  And le body contient :
    - error: "Too Many Requests"
    - message: contient "Rate limit exceeded"
    - retryAfter: <nombre de secondes>
  And le header Retry-After est présent
  And les requêtes suivantes continuent de recevoir 429 jusqu'à l'expiration de la fenêtre
```

**data-testid associés** :
- Response body: `error`, `message`, `retryAfter`
- Header: `Retry-After`

### AC-8 : Rate limiting fallback in-memory
```
Given le serveur MnM démarré SANS REDIS_URL
When un client dépasse 100 requêtes API en 60 secondes
Then la 101ème requête reçoit un status HTTP 429
  And le comportement est identique au rate limiting Redis (mêmes headers, même body)
  And le log affiche un warning si Redis était configuré mais indisponible
```

### AC-9 : Redis auto-reconnect
```
Given le serveur MnM démarré avec Redis connecté
When Redis est redémarré (docker compose restart redis)
Then le log affiche "Redis connection closed" puis "Redis reconnecting" puis "Redis connected"
  And le rate limiting continue de fonctionner (fallback in-memory pendant la déconnexion)
  And le health check reflète l'état actuel de Redis en temps réel
```

### AC-10 : Configuration redisUrl dans config.ts
```
Given la variable d'environnement REDIS_URL=redis://127.0.0.1:6379
When loadConfig() est appelé
Then config.redisUrl === "redis://127.0.0.1:6379"

Given REDIS_URL non défini
When loadConfig() est appelé
Then config.redisUrl === undefined
```

---

## data-test-id

**N/A pour les composants UI** — Cette story est backend-only. Aucun composant UI n'est ajouté ou modifié.

Les éléments testables sont des endpoints API et des headers HTTP :

| Élément | Type | Vérification |
|---------|------|-------------|
| `GET /api/health` | Endpoint | Réponse JSON avec champ `redis` |
| `redis.connected` | Champ JSON | Boolean — état de connexion Redis |
| `redis.latencyMs` | Champ JSON | Number — latence ping Redis |
| `redis.configured` | Champ JSON | Boolean — REDIS_URL est défini |
| `X-RateLimit-Limit` | Header HTTP | Number — limite max (100) |
| `X-RateLimit-Remaining` | Header HTTP | Number — requêtes restantes |
| `X-RateLimit-Reset` | Header HTTP | Number — unix timestamp reset |
| `Retry-After` | Header HTTP | Number — secondes avant retry (sur 429 seulement) |
| `429 Too Many Requests` | Status HTTP | Quand limite dépassée |

---

## Notes Techniques d'Implémentation

### ioredis — Pourquoi pas `redis` (node-redis) ?

`ioredis` est le choix pour MnM car :
1. **Auto-reconnect natif** avec stratégie configurable (sans plugin)
2. **Pipeline/multi** intégré (utilisé par le rate limiter)
3. **Pub/Sub** robuste (nécessaire pour CHAT-S01)
4. **Types TypeScript intégrés** (pas besoin de `@types`)
5. **Maturité** — utilisé par BullMQ, Nestjs, et la majorité de l'écosystème Node.js
6. **Compatibilité Redis 7** — support complet

### Rate Limiting — Fixed Window vs Sliding Window

L'architecture prévoit un rate limiting simple. On utilise le **fixed window counter** :
- **INCR** : incrémente le compteur pour la clé
- **EXPIRE** : met un TTL de `windowSeconds` si c'est la première requête de la fenêtre

**Avantages** : Simple, efficace, 2 commandes Redis (pipeline).
**Inconvénient** : Burst possible aux frontières de fenêtre (théoriquement 200 req au lieu de 100 si le burst chevauche deux fenêtres). Acceptable pour le MVP.

### Rate Limiting — Structure des clés Redis

```
rl:api:{ip}           — API général (100/min)
rl:login:{ip}         — Login (5/min) — futur, pas dans cette story
rl:invite:{companyId} — Invitations (20/h) — futur, pas dans cette story
rl:chat:{userId}      — Chat messages (10/min) — futur, pas dans cette story
```

Le préfixe `rl:api` est utilisé dans cette story. Les autres préfixes seront ajoutés par les stories respectives utilisant `createRateLimiter()` avec des configs différentes.

### Health Check — Pourquoi Redis ne rend pas "degraded" ?

Redis est optionnel dans MnM. Le serveur fonctionne sans Redis (rate limiting en mémoire, pas de pub/sub distribué). Seule la base de données PostgreSQL est critique. Donc :
- DB down → `status: "degraded"` (503)
- Redis down → `status: "ok"` mais `redis.connected: false` (200)

Cela permet aux monitoring tools de ne pas déclencher d'alertes quand Redis n'est pas configuré (mode dev solo, embedded-postgres).

### Graceful Shutdown

Au shutdown (`SIGINT`/`SIGTERM`), l'ordre de déconnexion est :
1. Redis `client.quit()` (ou `client.disconnect()` si quit timeout)
2. Embedded PostgreSQL `stop()` (si applicable)

Redis doit être fermé AVANT PostgreSQL car certaines opérations Redis pourraient dépendre de la DB (ex: sessions).

### Tests — Stratégie

Les tests pour TECH-04 doivent couvrir :

1. **Tests unitaires** (Vitest) :
   - `redis.ts` : `createRedisClient` avec et sans URL (mock ioredis)
   - `rate-limit.ts` : `InMemoryRateLimitStore` (pas besoin de Redis)
   - `rate-limit.ts` : `createRateLimiter` avec Redis mock et sans Redis
   - `config.ts` : `loadConfig()` inclut `redisUrl`

2. **Tests E2E** (Playwright/API) :
   - Health check retourne `redis.configured: false` quand pas de REDIS_URL
   - Health check retourne `redis.connected: true` quand Redis est up
   - Rate limiting renvoie les bons headers
   - Rate limiting renvoie 429 quand la limite est dépassée

---

## Edge Cases et Scénarios d'Erreur

### E1 : REDIS_URL mal formatée
```
Given REDIS_URL="not-a-valid-url"
When le serveur démarre
Then ioredis logue une erreur de connexion
  And le serveur démarre quand même (Redis est optionnel)
  And le rate limiting utilise le fallback in-memory
  And le health check retourne redis.configured: true, redis.connected: false
```

### E2 : Redis plein (maxmemory atteint)
```
Given Redis configuré avec maxmemory et toutes les clés rate-limit en mémoire
When Redis retourne une erreur OOM sur INCR
Then le rate limiter attrape l'erreur et utilise le fallback in-memory pour cette requête
  And un warning est logué
  And les requêtes suivantes continuent de fonctionner
```

### E3 : Redis très lent (>1s de latence)
```
Given Redis qui répond mais avec une latence anormale (>1s)
When le rate limiter exécute INCR + TTL
Then la requête est ralentie par la latence Redis
  And le health check reflète la haute latence dans redis.latencyMs
  And si Redis timeout (ioredis commandTimeout par défaut: 10s), le fallback in-memory prend le relais
```

### E4 : Requêtes concurrentes massives (burst)
```
Given 200 requêtes concurrentes depuis la même IP en <1s
When le rate limiter traite les requêtes
Then les 100 premières passent avec des headers X-RateLimit-Remaining décroissants
  And les 100 suivantes reçoivent 429
  And les compteurs Redis (ou in-memory) sont atomiques (INCR est atomique en Redis)
```

### E5 : IP derrière un reverse proxy (X-Forwarded-For)
```
Given un reverse proxy (nginx, Cloudflare) devant MnM
  And les requêtes ont le header X-Forwarded-For: "203.0.113.42, 10.0.0.1"
When le rate limiter extrait la clé IP
Then il utilise la première IP de X-Forwarded-For ("203.0.113.42")
  And deux clients différents derrière le même proxy ont des limites séparées
```

### E6 : Transition Redis disponible → indisponible → disponible
```
Given le serveur démarré avec Redis connecté
  And le rate limiter utilise Redis
When Redis est arrêté (docker compose stop redis)
Then le rate limiter passe automatiquement au fallback in-memory
  And un warning est logué une seule fois
When Redis est redémarré (docker compose start redis)
Then ioredis se reconnecte automatiquement
  And le rate limiter reprend l'utilisation de Redis
  And les compteurs in-memory sont réinitialisés (pas de double-count)
```

### E7 : Multiple instances MnM avec Redis partagé
```
Given deux instances MnM connectées au même Redis
When un client envoie 60 requêtes à l'instance A et 50 à l'instance B
Then le compteur Redis total est 110 (>100)
  And la 101ème requête (peu importe l'instance) reçoit 429
  And le rate limiting est distribué et cohérent
```
Note : Ce scénario n'est pas testable en E2E dans cette story (single-instance), mais le design le supporte.

---

## Dépendances Sortantes (ce que TECH-04 débloque)

| Story | Raison |
|-------|--------|
| CHAT-S01 | WebSocket bidirectionnel — utilise Redis pub/sub pour scaler les WebSocket |
| OBS-S03 | Résumé LLM — utilise Redis comme cache pour les résumés |
| Toute story avec rate limiting spécifique | Réutilise `createRateLimiter()` avec des configs différentes (login, invitations, chat) |

---

## Fichiers Impactés (Résumé)

| Fichier | Action | Tâche |
|---------|--------|-------|
| `server/package.json` | Modifier | T1 — Ajouter ioredis |
| `server/src/config.ts` | Modifier | T2 — Ajouter redisUrl |
| `server/src/redis.ts` | Créer | T3 — Module client Redis |
| `server/src/index.ts` | Modifier | T4 — Init Redis au startup |
| `server/src/routes/health.ts` | Modifier | T5 — Statut Redis dans health check |
| `server/src/middleware/rate-limit.ts` | Créer | T6 — Middleware rate limiting |
| `server/src/app.ts` | Modifier | T7 — Appliquer rate limiter sur /api |
| `server/src/middleware/index.ts` | Modifier | T8 — Export rate-limit |

---

## Critères de Définition of Done

- [ ] `ioredis` installé dans `server/package.json`
- [ ] `config.redisUrl` résolu depuis `REDIS_URL` env var
- [ ] `server/src/redis.ts` créé avec `createRedisClient()`, `pingRedis()`, `disconnectRedis()`
- [ ] Redis client initialisé au startup dans `index.ts` (optionnel, ne bloque pas le démarrage)
- [ ] Health check retourne `redis.connected`, `redis.latencyMs`, `redis.configured`
- [ ] Redis non connecté ne rend PAS le health check "degraded"
- [ ] Middleware `createRateLimiter()` créé avec fallback in-memory
- [ ] Rate limiting API général appliqué (100 req/60s par IP)
- [ ] Réponse 429 avec headers `X-RateLimit-*` et `Retry-After` quand limite dépassée
- [ ] Le serveur démarre et fonctionne normalement SANS Redis
- [ ] Le serveur se reconnecte automatiquement si Redis redémarre
- [ ] Graceful shutdown déconnecte Redis
- [ ] Tous les tests existants passent (`pnpm test:run`)
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
