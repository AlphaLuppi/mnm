/**
 * Instance-level configuration endpoints.
 *
 * Surface for the in-app onboarding wizard / admin settings to configure
 * optional integrations (LLM provider, etc.) without editing `.env`. These
 * routes are NOT tenant-scoped — they configure the whole MnM instance.
 *
 * Auth: instance-admin only. In `local_trusted` mode the synthetic
 * local-board user is instance_admin so dev / standalone work without setup.
 */

import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { instanceUserRoles } from "@mnm/db";
import { badRequest, forbidden } from "../errors.js";
import {
  clearInstanceLlmConfig,
  getInstanceLlmConfigPublic,
  setInstanceLlmConfig,
  type LlmProvider,
} from "../services/instance-llm-config.js";

async function assertInstanceAdmin(db: Db, userId: string | null): Promise<void> {
  if (!userId) {
    throw forbidden("Instance admin required");
  }
  const rows = await db
    .select({ role: instanceUserRoles.role })
    .from(instanceUserRoles)
    .where(eq(instanceUserRoles.userId, userId));
  const isAdmin = rows.some((r) => r.role === "instance_admin");
  if (!isAdmin) {
    throw forbidden("Instance admin required");
  }
}

const SUPPORTED_PROVIDERS: ReadonlyArray<LlmProvider> = ["anthropic", "openai"];

export function instanceConfigRoutes(db: Db) {
  const router = Router();

  router.get("/instance-config/llm", async (_req, res) => {
    res.json(getInstanceLlmConfigPublic());
  });

  router.put("/instance-config/llm", async (req, res) => {
    await assertInstanceAdmin(db, req.actor?.userId ?? null);

    const provider = req.body?.provider;
    const apiKey = req.body?.apiKey;
    if (typeof provider !== "string" || !SUPPORTED_PROVIDERS.includes(provider as LlmProvider)) {
      throw badRequest(`provider must be one of: ${SUPPORTED_PROVIDERS.join(", ")}`);
    }
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      throw badRequest("apiKey is required");
    }

    const updated = setInstanceLlmConfig({
      provider: provider as LlmProvider,
      apiKey,
    });
    res.json(updated);
  });

  router.delete("/instance-config/llm", async (req, res) => {
    await assertInstanceAdmin(db, req.actor?.userId ?? null);
    clearInstanceLlmConfig();
    res.json(getInstanceLlmConfigPublic());
  });

  return router;
}
