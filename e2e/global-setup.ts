/**
 * Playwright global setup — creates an authenticated browser session with real data.
 *
 * 1. Waits for the server to be healthy
 * 2. Signs up (or signs in) a test user via better-auth email+password API
 * 3. Calls /api/e2e-seed/ensure-access to grant instance_admin + company membership
 *    (requires MNM_E2E_SEED=true on the server)
 * 4. Saves the session cookies to e2e/.auth/storageState.json
 *
 * All browser-project tests then reuse this authenticated state.
 */
import { request } from "@playwright/test";

const BASE_URL = process.env.MNM_BASE_URL ?? "http://localhost:3100";
const TEST_USER = {
  name: "E2E Test User",
  email: "e2e-playwright@test.dev",
  password: "E2eTestPass!2026",
};
const STORAGE_STATE_PATH = "e2e/.auth/storageState.json";

async function waitForServer(maxWaitMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${BASE_URL} not healthy after ${maxWaitMs}ms`);
}

export default async function globalSetup() {
  await waitForServer();

  const ctx = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Origin: BASE_URL },
  });

  // --- Step 1: Authenticate test user ---
  let authRes = await ctx.post("/api/auth/sign-up/email", {
    data: {
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });

  if (!authRes.ok()) {
    // User may already exist — sign in instead
    authRes = await ctx.post("/api/auth/sign-in/email", {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });
  }

  if (!authRes.ok()) {
    const text = await authRes.text();
    throw new Error(`Auth failed (${authRes.status()}): ${text}`);
  }

  // Verify session
  const sessionRes = await ctx.get("/api/auth/get-session");
  if (!sessionRes.ok()) {
    throw new Error(`Session verification failed: ${sessionRes.status()}`);
  }
  const session = await sessionRes.json();
  if (!session?.user?.id) {
    throw new Error(`No user in session: ${JSON.stringify(session)}`);
  }

  // --- Step 2: Seed access (instance_admin + company membership) ---
  const seedRes = await ctx.post("/api/e2e-seed/ensure-access");
  if (seedRes.ok()) {
    const seed = await seedRes.json();
    console.log(`[e2e-setup] Seeded: userId=${seed.userId}, companiesJoined=${seed.companiesJoined}`);
  } else if (seedRes.status() === 404) {
    console.warn(
      "[e2e-setup] E2E seed endpoint not available (MNM_E2E_SEED not set). " +
      "Browser tests requiring company access may fail."
    );
  } else {
    console.warn(`[e2e-setup] Seed failed (${seedRes.status()}): ${await seedRes.text()}`);
  }

  // --- Step 3: Save auth state ---
  await ctx.storageState({ path: STORAGE_STATE_PATH });
  await ctx.dispose();

  process.env.E2E_USER_ID = session.user.id;
  process.env.E2E_USER_EMAIL = session.user.email;
  process.env.E2E_USER_NAME = session.user.name;
}
