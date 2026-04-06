import { Router } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { viewPresets, roles, companyMemberships, userWidgets } from "@mnm/db";
import type { DashboardWidget, LayoutOverrides, UserWidget } from "@mnm/shared";
import { layoutOverridesV2Schema } from "@mnm/shared";
import { requirePermission } from "../middleware/require-permission.js";
import { badRequest, notFound } from "../errors.js";
import { materializeLayout, mergeNewWidgets } from "../services/layout-materializer.js";

export function viewPresetRoutes(db: Db) {
  const router = Router();

  // ── GET /view-presets — List all presets for the company
  router.get(
    "/companies/:companyId/view-presets",
    requirePermission(db, "roles:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;

      const presets = await db
        .select()
        .from(viewPresets)
        .where(eq(viewPresets.companyId, companyId))
        .orderBy(viewPresets.slug);

      res.json(presets);
    },
  );

  // ── GET /view-presets/:id — Get a single preset
  router.get(
    "/companies/:companyId/view-presets/:presetId",
    requirePermission(db, "roles:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const presetId = req.params.presetId as string;

      const [preset] = await db
        .select()
        .from(viewPresets)
        .where(and(eq(viewPresets.id, presetId), eq(viewPresets.companyId, companyId)));

      if (!preset) throw notFound("View preset not found");

      res.json(preset);
    },
  );

  // ── POST /view-presets — Create a preset
  router.post(
    "/companies/:companyId/view-presets",
    requirePermission(db, "roles:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const { slug, name, description, icon, color, layout, isDefault } = req.body;

      if (!slug || !name) throw badRequest("slug and name are required");
      if (!layout || typeof layout !== "object") throw badRequest("layout is required and must be an object");

      // If setting as default, unset other defaults
      if (isDefault) {
        await db
          .update(viewPresets)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(viewPresets.companyId, companyId), eq(viewPresets.isDefault, true)));
      }

      const [created] = await db
        .insert(viewPresets)
        .values({
          companyId,
          slug,
          name,
          description: description ?? null,
          icon: icon ?? null,
          color: color ?? null,
          layout,
          isDefault: isDefault ?? false,
        })
        .returning();

      res.status(201).json(created);
    },
  );

  // ── PATCH /view-presets/:id — Update a preset
  router.patch(
    "/companies/:companyId/view-presets/:presetId",
    requirePermission(db, "roles:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const presetId = req.params.presetId as string;
      const { name, description, icon, color, layout, isDefault } = req.body;

      const [existing] = await db
        .select()
        .from(viewPresets)
        .where(and(eq(viewPresets.id, presetId), eq(viewPresets.companyId, companyId)));

      if (!existing) throw notFound("View preset not found");

      // If setting as default, unset other defaults
      if (isDefault && !existing.isDefault) {
        await db
          .update(viewPresets)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(viewPresets.companyId, companyId), eq(viewPresets.isDefault, true)));
      }

      const updates: Partial<typeof viewPresets.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (icon !== undefined) updates.icon = icon;
      if (color !== undefined) updates.color = color;
      if (layout !== undefined) updates.layout = layout;
      if (isDefault !== undefined) updates.isDefault = isDefault;

      const [updated] = await db
        .update(viewPresets)
        .set(updates)
        .where(and(eq(viewPresets.id, presetId), eq(viewPresets.companyId, companyId)))
        .returning();

      res.json(updated);
    },
  );

  // ── DELETE /view-presets/:id — Delete a preset
  router.delete(
    "/companies/:companyId/view-presets/:presetId",
    requirePermission(db, "roles:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const presetId = req.params.presetId as string;

      const [existing] = await db
        .select()
        .from(viewPresets)
        .where(and(eq(viewPresets.id, presetId), eq(viewPresets.companyId, companyId)));

      if (!existing) throw notFound("View preset not found");

      await db
        .delete(viewPresets)
        .where(and(eq(viewPresets.id, presetId), eq(viewPresets.companyId, companyId)));

      res.status(204).end();
    },
  );

  // ── GET /my-view — Get the resolved view for the current user
  router.get(
    "/companies/:companyId/my-view",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = req.actor?.userId;

      if (!userId) {
        res.json({ preset: null, overrides: null, grid: null });
        return;
      }

      // Get membership + role + preset in one flow
      const [membership] = await db
        .select({
          layoutOverrides: companyMemberships.layoutOverrides,
          roleId: companyMemberships.roleId,
        })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, companyId),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, userId),
          ),
        );

      if (!membership) {
        res.json({ preset: null, overrides: null, grid: null });
        return;
      }

      // Get the role's preset
      let preset = null;
      if (membership.roleId) {
        const [role] = await db
          .select({ viewPresetId: roles.viewPresetId })
          .from(roles)
          .where(eq(roles.id, membership.roleId));

        if (role?.viewPresetId) {
          const [p] = await db
            .select()
            .from(viewPresets)
            .where(eq(viewPresets.id, role.viewPresetId));
          if (p) preset = p;
        }
      }

      // Fallback to default preset
      if (!preset) {
        const [defaultPreset] = await db
          .select()
          .from(viewPresets)
          .where(and(eq(viewPresets.companyId, companyId), eq(viewPresets.isDefault, true)));
        if (defaultPreset) preset = defaultPreset;
      }

      // V2: Materialize grid layout
      const userWidgetRows = (await db
        .select()
        .from(userWidgets)
        .where(
          and(
            eq(userWidgets.companyId, companyId),
            eq(userWidgets.userId, userId),
          ),
        )
        .orderBy(userWidgets.position)) as unknown as UserWidget[];

      const presetLayout = preset?.layout as { dashboard?: { widgets?: DashboardWidget[] } } | null;
      const presetWidgets: DashboardWidget[] = presetLayout?.dashboard?.widgets ?? [];
      const overrides = (membership.layoutOverrides ?? {}) as LayoutOverrides;
      const dashboardOverrides = overrides.dashboard;

      let grid;
      if (dashboardOverrides?.layout) {
        grid = mergeNewWidgets(dashboardOverrides.layout, presetWidgets, userWidgetRows);
      } else {
        grid = materializeLayout(presetWidgets, userWidgetRows);
      }

      res.json({
        preset: preset
          ? {
              id: preset.id,
              slug: preset.slug,
              name: preset.name,
              icon: preset.icon,
              color: preset.color,
              layout: preset.layout,
            }
          : null,
        overrides: membership.layoutOverrides ?? null,
        grid,
      });
    },
  );

  // ── PATCH /my-view/overrides — Save user's layout overrides
  router.patch(
    "/companies/:companyId/my-view/overrides",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = req.actor?.userId;

      if (!userId) throw badRequest("User ID required");

      const parsed = layoutOverridesV2Schema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(`Invalid layout overrides: ${parsed.error.issues.map((issue: { message: string }) => issue.message).join(", ")}`);
      }
      const overrides = parsed.data;

      const [updated] = await db
        .update(companyMemberships)
        .set({ layoutOverrides: overrides, updatedAt: new Date() })
        .where(
          and(
            eq(companyMemberships.companyId, companyId),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, userId),
          ),
        )
        .returning();

      if (!updated) throw notFound("Membership not found");

      res.json({ overrides: updated.layoutOverrides });
    },
  );

  return router;
}
