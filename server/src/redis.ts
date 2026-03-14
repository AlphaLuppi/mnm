import { Redis } from "ioredis";
import { logger } from "./middleware/logger.js";

export interface RedisState {
  client: Redis | null;
  connected: boolean;
}

/**
 * Create a Redis client with auto-reconnect and exponential backoff.
 * Returns null client if no URL is provided (Redis is optional).
 */
export function createRedisClient(redisUrl: string | undefined): RedisState {
  if (!redisUrl) {
    logger.info("No REDIS_URL configured; Redis features disabled");
    return { client: null, connected: false };
  }

  const state: RedisState = { client: null, connected: false };

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      logger.warn({ attempt: times, delayMs: delay }, "Redis reconnecting");
      return delay;
    },
    lazyConnect: false,
  });

  client.on("connect", () => {
    logger.info("Redis connected");
    state.connected = true;
  });

  client.on("ready", () => {
    logger.info("Redis ready");
    state.connected = true;
  });

  client.on("error", (err) => {
    logger.error({ err }, "Redis error");
    state.connected = false;
  });

  client.on("close", () => {
    logger.warn("Redis connection closed");
    state.connected = false;
  });

  client.on("reconnecting", () => {
    logger.info("Redis reconnecting...");
  });

  state.client = client;
  return state;
}

/**
 * Ping Redis and return latency in milliseconds.
 * Returns null if Redis is not available.
 */
export async function pingRedis(
  state: RedisState,
): Promise<{ latencyMs: number } | null> {
  if (!state.client || !state.connected) return null;

  try {
    const start = performance.now();
    await state.client.ping();
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return { latencyMs };
  } catch {
    return null;
  }
}

/**
 * Gracefully disconnect the Redis client.
 */
export async function disconnectRedis(state: RedisState): Promise<void> {
  if (!state.client) return;

  try {
    await state.client.quit();
    logger.info("Redis disconnected gracefully");
  } catch (err) {
    logger.error({ err }, "Error disconnecting Redis");
    try {
      state.client.disconnect();
    } catch {
      // ignore
    }
  }
  state.connected = false;
}
