/**
 * Playwright Global Setup — Multi-role authenticated sessions + seed data.
 *
 * Flow:
 *   1. Wait for server health check
 *   2. Register 5 test users via Better Auth sign-up (or sign-in if exists)
 *   3. Seed companies, memberships, agents, projects, workflows via e2e-seed API
 *   4. Save 4 role-based auth states (admin, manager, contributor, viewer)
 *   5. Save legacy auth state for backward compatibility with existing browser tests
 *
 * Requires:
 *   - MnM server running with MNM_E2E_SEED=true
 *   - PostgreSQL with migrations applied
 *
 * Auth state files are written to e2e/.auth/
 */
import { request } from "@playwright/test";
import {
  USERS,
  AUTH_STATES,
  BASE_URL,
  COMPANIES,
  AGENTS,
  PROJECTS,
  GOALS,
  WORKFLOW_TEMPLATES,
  CONTAINER_PROFILES,
  AUTOMATION_CURSORS,
  SAMPLE_AUDIT_EVENTS,
  runtimeIds,
  type TestUserKey,
} from "./fixtures/seed-data";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuthResult {
  userId: string;
  email: string;
  name: string;
}

// ─── Server Health Check ────────────────────────────────────────────────────

async function waitForServer(maxWaitMs = 30_000): Promise<void> {
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

// ─── Auth Helpers ───────────────────────────────────────────────────────────

async function authenticateUser(
  ctx: Awaited<ReturnType<typeof request.newContext>>,
  user: { name: string; email: string; password: string },
): Promise<AuthResult> {
  // Try sign-up first
  let authRes = await ctx.post("/api/auth/sign-up/email", {
    data: {
      name: user.name,
      email: user.email,
      password: user.password,
    },
  });

  // If user exists, sign-in
  if (!authRes.ok()) {
    authRes = await ctx.post("/api/auth/sign-in/email", {
      data: {
        email: user.email,
        password: user.password,
      },
    });
  }

  if (!authRes.ok()) {
    const text = await authRes.text();
    throw new Error(`Auth failed for ${user.email} (${authRes.status()}): ${text}`);
  }

  // Verify session
  const sessionRes = await ctx.get("/api/auth/get-session");
  if (!sessionRes.ok()) {
    throw new Error(`Session verification failed for ${user.email}: ${sessionRes.status()}`);
  }

  const session = await sessionRes.json();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error(`No user ID in session for ${user.email}: ${JSON.stringify(session)}`);
  }

  return {
    userId,
    email: session.user.email ?? user.email,
    name: session.user.name ?? user.name,
  };
}

// ─── Seed Data via API ──────────────────────────────────────────────────────

async function seedViaApi(
  ctx: Awaited<ReturnType<typeof request.newContext>>,
  userResults: Record<TestUserKey, AuthResult>,
): Promise<void> {
  // Call the comprehensive e2e-seed endpoint
  const seedRes = await ctx.post("/api/e2e-seed/ensure-access");

  if (seedRes.ok()) {
    const seed = await seedRes.json();
    console.log(`[e2e-setup] Basic seed: userId=${seed.userId}, companiesJoined=${seed.companiesJoined}`);
  } else if (seedRes.status() === 404) {
    console.warn(
      "[e2e-setup] E2E seed endpoint not available (MNM_E2E_SEED not set). " +
        "Some tests may fail without seeded data.",
    );
  } else {
    console.warn(`[e2e-setup] Basic seed failed (${seedRes.status()}): ${await seedRes.text()}`);
  }

  // Seed multi-role access — each user gets specific company membership
  const seedMultiRes = await ctx.post("/api/e2e-seed/ensure-multi-role-access", {
    data: {
      users: Object.entries(userResults).map(([key, result]) => {
        const userDef = USERS[key as TestUserKey];
        return {
          userId: result.userId,
          email: result.email,
          businessRole: userDef.businessRole,
          company: userDef.company,
        };
      }),
      companies: COMPANIES,
      agents: AGENTS,
      projects: PROJECTS,
      goals: GOALS,
      workflowTemplates: WORKFLOW_TEMPLATES,
      containerProfiles: CONTAINER_PROFILES,
      automationCursors: AUTOMATION_CURSORS,
      auditEvents: SAMPLE_AUDIT_EVENTS,
    },
  });

  if (seedMultiRes.ok()) {
    const seedData = await seedMultiRes.json();
    console.log(`[e2e-setup] Multi-role seed complete:`, JSON.stringify(seedData).slice(0, 200));
  } else if (seedMultiRes.status() === 404) {
    // Endpoint may not exist yet — fall back to basic seed
    console.warn(
      "[e2e-setup] Multi-role seed endpoint not available. " +
        "Falling back to basic ensure-access for admin only.",
    );
  } else {
    console.warn(`[e2e-setup] Multi-role seed failed (${seedMultiRes.status()}): ${await seedMultiRes.text()}`);
  }
}

// ─── Main Setup ─────────────────────────────────────────────────────────────

export default async function globalSetup(): Promise<void> {
  console.log("[e2e-setup] Starting global setup...");
  await waitForServer();
  console.log("[e2e-setup] Server is healthy.");

  // ─── Step 1: Authenticate all test users ──────────────────────────────────

  const userResults: Record<string, AuthResult> = {};
  const roleToStorageState: Record<string, string> = {
    novaTechAdmin: AUTH_STATES.admin,
    novaTechManager: AUTH_STATES.manager,
    novaTechContributor: AUTH_STATES.contributor,
    novaTechViewer: AUTH_STATES.viewer,
  };

  for (const [userKey, userDef] of Object.entries(USERS)) {
    const ctx = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Origin: BASE_URL },
    });

    try {
      const result = await authenticateUser(ctx, userDef);
      userResults[userKey] = result;

      // Update runtime IDs
      const idKey = `${userKey.replace(/([A-Z])/g, "_$1").toUpperCase()}_USER`;
      if (idKey in runtimeIds) {
        runtimeIds[idKey] = result.userId;
      }

      // Save auth state for role-based fixture
      const storageStatePath = roleToStorageState[userKey];
      if (storageStatePath) {
        await ctx.storageState({ path: storageStatePath });
        console.log(`[e2e-setup] Auth state saved: ${userKey} -> ${storageStatePath}`);
      }

      // Also save admin as legacy default storage state
      if (userKey === "novaTechAdmin") {
        await ctx.storageState({ path: AUTH_STATES.default });
        console.log(`[e2e-setup] Legacy auth state saved: ${AUTH_STATES.default}`);
      }
    } finally {
      await ctx.dispose();
    }
  }

  console.log(
    `[e2e-setup] Authenticated ${Object.keys(userResults).length} users: ` +
      Object.entries(userResults)
        .map(([k, v]) => `${k}=${v.userId.slice(0, 8)}`)
        .join(", "),
  );

  // ─── Step 2: Seed data via API (admin context) ───────────────────────────

  const adminCtx = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Origin: BASE_URL },
    storageState: AUTH_STATES.admin,
  });

  try {
    await seedViaApi(adminCtx, userResults as Record<TestUserKey, AuthResult>);
  } finally {
    await adminCtx.dispose();
  }

  // ─── Step 3: Store runtime info for tests ────────────────────────────────

  process.env.E2E_USER_ID = userResults.novaTechAdmin?.userId ?? "";
  process.env.E2E_USER_EMAIL = userResults.novaTechAdmin?.email ?? "";
  process.env.E2E_USER_NAME = userResults.novaTechAdmin?.name ?? "";
  process.env.E2E_ADMIN_USER_ID = userResults.novaTechAdmin?.userId ?? "";
  process.env.E2E_MANAGER_USER_ID = userResults.novaTechManager?.userId ?? "";
  process.env.E2E_CONTRIBUTOR_USER_ID = userResults.novaTechContributor?.userId ?? "";
  process.env.E2E_VIEWER_USER_ID = userResults.novaTechViewer?.userId ?? "";

  console.log("[e2e-setup] Global setup complete.");
}
