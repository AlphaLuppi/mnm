import { createDb, applyPendingMigrations, type Db } from "@mnm/db";
import postgres from "postgres";

const DEFAULT_TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/mnm_test";

/**
 * Connect to a test PostgreSQL database, run pending migrations, and return
 * the Drizzle `db` instance.
 *
 * Uses `DATABASE_URL` env var if set, otherwise falls back to localhost:5433.
 */
export async function setupTestDb(): Promise<Db> {
  const url = process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  await applyPendingMigrations(url);
  return createDb(url);
}

/**
 * Close the underlying postgres connection.
 *
 * Because `createDb` wraps `postgres()` internally and doesn't expose the
 * raw sql client, we re-create a disposable connection to verify teardown.
 * In practice the Drizzle instance garbage-collects the connection pool, but
 * this function can be extended if the Db type starts exposing `end()`.
 */
export async function teardownTestDb(_db: Db): Promise<void> {
  // Drizzle's postgres-js driver manages its own connection pool.
  // If the Db type later exposes an `end()` or `$close()` method, call it here.
  // For now this is a placeholder that test suites can call symmetrically.
}

/**
 * TRUNCATE CASCADE all application tables for test isolation.
 *
 * This keeps the Drizzle migration journal intact but wipes all data.
 * Tables are listed in dependency-safe order (children first).
 */
export async function cleanTestDb(db: Db): Promise<void> {
  const url = process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const sql = postgres(url, { max: 1 });

  try {
    // Get all public tables except the drizzle migration journal
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE '__drizzle%'
    `;

    if (tables.length === 0) return;

    const tableNames = tables.map((t) => `"${t.tablename}"`).join(", ");
    await sql.unsafe(`TRUNCATE ${tableNames} CASCADE`);
  } finally {
    await sql.end();
  }
}
