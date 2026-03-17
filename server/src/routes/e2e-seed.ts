/**
 * E2E test seed endpoint — only available when MNM_E2E_SEED=true.
 *
 * POST /api/e2e-seed/ensure-access
 *   Grants instance_admin role and company membership to the authenticated user.
 *   This allows the test user to access the full UI for browser-based E2E tests.
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { instanceUserRoles, companyMemberships, companies } from "@mnm/db";

export function e2eSeedRoutes(db: Db) {
  const router = Router();

  router.post("/e2e-seed/ensure-access", async (req, res) => {
    if (process.env.MNM_E2E_SEED !== "true") {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const userId = (req as any).actor?.userId as string | undefined;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // 1. Grant instance_admin if not already
    const existingRole = await db
      .select()
      .from(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
      .then((rows) => rows[0] ?? null);

    if (!existingRole) {
      await db.insert(instanceUserRoles).values({ userId, role: "instance_admin" });
    }

    // 2. Ensure membership in all companies
    const allCompanies = await db.select({ id: companies.id }).from(companies);
    for (const company of allCompanies) {
      const existing = await db
        .select()
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, company.id),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, userId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!existing) {
        await db.insert(companyMemberships).values({
          companyId: company.id,
          principalType: "user",
          principalId: userId,
          status: "active",
          businessRole: "admin",
        });
      }
    }

    res.json({ ok: true, userId, companiesJoined: allCompanies.length });
  });

  return router;
}
