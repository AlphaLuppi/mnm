import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { RedisState } from "../redis.js";
import { logger } from "./logger.js";

export interface RateLimiterOptions {
  redisState?: RedisState | null;
  /** Time window in milliseconds (default: 60_000) */
  windowMs?: number;
  /** Maximum requests per window (default: 100) */
  max?: number;
  /** Function to generate the rate limit key from a request (default: req.ip) */
  keyGenerator?: (req: Request) => string;
}

interface InMemoryEntry {
  count: number;
  resetAt: number;
}

/**
 * Create rate limiting middleware using Redis (distributed) or in-memory (fallback).
 * Uses a fixed-window counter pattern.
 */
export function createRateLimiter(opts: RateLimiterOptions = {}): RequestHandler {
  const {
    redisState = null,
    windowMs = 60_000,
    max = 100,
    keyGenerator = (req: Request) => req.ip ?? "unknown",
  } = opts;

  const windowSec = Math.ceil(windowMs / 1000);

  // In-memory fallback store
  const memoryStore = new Map<string, InMemoryEntry>();

  // Periodically clean up expired in-memory entries
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, windowMs);
  cleanupInterval.unref();

  async function getRedisCount(
    key: string,
  ): Promise<{ count: number; resetAt: number } | null> {
    if (!redisState?.client || !redisState.connected) return null;

    try {
      const redisKey = `rl:${key}`;
      const current = await redisState.client.incr(redisKey);

      if (current === 1) {
        // First request in this window — set expiry
        await redisState.client.expire(redisKey, windowSec);
      }

      const ttl = await redisState.client.ttl(redisKey);
      const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);

      return { count: current, resetAt };
    } catch (err) {
      logger.warn({ err }, "Redis rate limit failed; falling back to in-memory");
      return null;
    }
  }

  function getMemoryCount(key: string): { count: number; resetAt: number } {
    const now = Date.now();
    let entry = memoryStore.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      memoryStore.set(key, entry);
    }

    entry.count += 1;
    return { count: entry.count, resetAt: entry.resetAt };
  }

  // Disable rate limiting in E2E mode (parallel Playwright tests from same IP exceed limits)
  const isE2eMode = process.env.MNM_E2E_SEED === "true";

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isE2eMode) { next(); return; }
    const key = keyGenerator(req);

    let result = await getRedisCount(key);
    if (!result) {
      result = getMemoryCount(key);
    }

    const { count, resetAt } = result;
    const remaining = Math.max(0, max - count);
    const resetEpochSec = Math.ceil(resetAt / 1000);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetEpochSec));

    if (count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec,
      });
      return;
    }

    next();
  };
}
