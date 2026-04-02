import { and, eq, desc, sql, isNull, asc } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Db } from "@mnm/db";
import {
  configLayers,
  configLayerItems,
  configLayerFiles,
  configLayerRevisions,
} from "@mnm/db";
import { notFound, badRequest, conflict } from "../errors.js";
import { auditService } from "./audit.js";
import { sanitizeRecord } from "../redaction.js";
import type {
  CreateConfigLayer,
  UpdateConfigLayer,
  CreateConfigLayerItem,
  UpdateConfigLayerItem,
  CreateConfigLayerFile,
} from "@mnm/shared";

export function configLayerService(db: Db) {
  const audit = auditService(db);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function sha256(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  async function nextVersion(
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    layerId: string,
  ): Promise<number> {
    const result = await tx
      .select({ maxVersion: sql<number>`COALESCE(MAX(${configLayerRevisions.version}), 0)` })
      .from(configLayerRevisions)
      .where(eq(configLayerRevisions.layerId, layerId));
    return (result[0]?.maxVersion ?? 0) + 1;
  }

  async function buildSnapshot(
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    layerId: string,
  ): Promise<Record<string, unknown>> {
    const items = await tx
      .select()
      .from(configLayerItems)
      .where(eq(configLayerItems.layerId, layerId));

    const files = await tx
      .select()
      .from(configLayerFiles)
      .where(
        items.length > 0
          ? sql`${configLayerFiles.itemId} IN (${sql.join(items.map((i) => sql`${i.id}::uuid`), sql`, `)})`
          : sql`false`,
      );

    const sanitizedItems = items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      name: item.name,
      displayName: item.displayName,
      configJson: sanitizeRecord(item.configJson as Record<string, unknown>),
      sourceType: item.sourceType,
      enabled: item.enabled,
    }));

    const sanitizedFiles = files.map((file) => ({
      id: file.id,
      itemId: file.itemId,
      path: file.path,
      contentHash: file.contentHash,
    }));

    return { items: sanitizedItems, files: sanitizedFiles };
  }

  async function createRevision(
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    layerId: string,
    companyId: string,
    changedBy: string,
    changedKeys: string[],
    changeSource: string,
    changeMessage?: string,
  ) {
    const version = await nextVersion(tx, layerId);
    const afterSnapshot = await buildSnapshot(tx, layerId);
    const [rev] = await tx
      .insert(configLayerRevisions)
      .values({
        companyId,
        layerId,
        version,
        changedKeys,
        afterSnapshot,
        changedBy,
        changeSource,
        changeMessage: changeMessage ?? null,
      })
      .returning();
    return rev!;
  }

  // ─── Layer CRUD ──────────────────────────────────────────────────────────────

  async function createLayer(
    companyId: string,
    userId: string,
    input: CreateConfigLayer,
  ) {
    return db.transaction(async (tx) => {
      const [layer] = await tx
        .insert(configLayers)
        .values({
          companyId,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? null,
          scope: input.scope,
          enforced: input.enforced ?? false,
          visibility: input.visibility ?? "public",
          createdByUserId: userId,
        })
        .returning();

      await createRevision(
        tx,
        layer!.id,
        companyId,
        userId,
        ["name", "scope", "enforced", "visibility"],
        "ui",
        "Layer created",
      );

      await audit.emit({
        companyId,
        actorId: userId,
        actorType: "user",
        action: "config_layer.created",
        targetType: "config_layer",
        targetId: layer!.id,
        metadata: { name: input.name, scope: input.scope },
      });

      return layer!;
    });
  }

  async function createBaseLayer(
    companyId: string,
    userId: string,
    agentName: string,
  ) {
    return db.transaction(async (tx) => {
      const [layer] = await tx
        .insert(configLayers)
        .values({
          companyId,
          name: `${agentName} - Base`,
          scope: "private",
          isBaseLayer: true,
          createdByUserId: userId,
          visibility: "private",
        })
        .returning();

      await createRevision(
        tx,
        layer!.id,
        companyId,
        userId,
        ["name", "scope", "is_base_layer"],
        "system",
        "Base layer created for agent",
      );

      return layer!;
    });
  }

  async function getLayer(layerId: string) {
    const layer = await db
      .select()
      .from(configLayers)
      .where(eq(configLayers.id, layerId))
      .then((rows) => rows[0] ?? null);

    if (!layer) throw notFound("Config layer not found");

    const items = await db
      .select()
      .from(configLayerItems)
      .where(eq(configLayerItems.layerId, layerId));

    return { ...layer, items };
  }

  async function listLayers(
    companyId: string,
    opts?: { scope?: string; includeArchived?: boolean },
  ) {
    const conditions = [
      eq(configLayers.companyId, companyId),
      eq(configLayers.isBaseLayer, false),
    ];

    if (!opts?.includeArchived) {
      conditions.push(isNull(configLayers.archivedAt));
    }

    if (opts?.scope) {
      conditions.push(eq(configLayers.scope, opts.scope));
    }

    return db
      .select()
      .from(configLayers)
      .where(and(...conditions))
      .orderBy(asc(configLayers.name));
  }

  async function updateLayer(
    layerId: string,
    userId: string,
    input: UpdateConfigLayer,
  ) {
    return db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(configLayers)
        .where(eq(configLayers.id, layerId))
        .then((rows) => rows[0] ?? null);

      if (!existing) throw notFound("Config layer not found");

      const changedKeys: string[] = [];
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (input.name !== undefined && input.name !== existing.name) {
        updates.name = input.name;
        changedKeys.push("name");
      }
      if (input.description !== undefined && input.description !== existing.description) {
        updates.description = input.description;
        changedKeys.push("description");
      }
      if (input.icon !== undefined && input.icon !== existing.icon) {
        updates.icon = input.icon;
        changedKeys.push("icon");
      }
      if (input.enforced !== undefined && input.enforced !== existing.enforced) {
        updates.enforced = input.enforced;
        changedKeys.push("enforced");
      }
      if (input.visibility !== undefined && input.visibility !== existing.visibility) {
        updates.visibility = input.visibility;
        changedKeys.push("visibility");
      }

      // If promoted and content changed, reset promotion status
      if (
        existing.promotionStatus === "approved" &&
        changedKeys.length > 0
      ) {
        updates.promotionStatus = "proposed";
        changedKeys.push("promotionStatus");
      }

      if (changedKeys.length === 0) return existing;

      const [updated] = await tx
        .update(configLayers)
        .set(updates)
        .where(eq(configLayers.id, layerId))
        .returning();

      await createRevision(
        tx,
        layerId,
        existing.companyId,
        userId,
        changedKeys,
        "ui",
        "Layer updated",
      );

      return updated!;
    });
  }

  async function archiveLayer(layerId: string, userId: string) {
    const layer = await db
      .select()
      .from(configLayers)
      .where(eq(configLayers.id, layerId))
      .then((rows) => rows[0] ?? null);

    if (!layer) throw notFound("Config layer not found");
    if (layer.isBaseLayer) throw badRequest("Cannot archive a base layer");

    const [updated] = await db
      .update(configLayers)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(configLayers.id, layerId))
      .returning();

    await audit.emit({
      companyId: layer.companyId,
      actorId: userId,
      actorType: "user",
      action: "config_layer.archived",
      targetType: "config_layer",
      targetId: layerId,
      metadata: { name: layer.name },
    });

    return updated!;
  }

  // ─── Item CRUD ───────────────────────────────────────────────────────────────

  async function addItem(
    layerId: string,
    userId: string,
    input: CreateConfigLayerItem,
  ) {
    return db.transaction(async (tx) => {
      const layer = await tx
        .select()
        .from(configLayers)
        .where(eq(configLayers.id, layerId))
        .then((rows) => rows[0] ?? null);

      if (!layer) throw notFound("Config layer not found");

      const [item] = await tx
        .insert(configLayerItems)
        .values({
          companyId: layer.companyId,
          layerId,
          itemType: input.itemType,
          name: input.name,
          displayName: input.displayName ?? null,
          description: input.description ?? null,
          configJson: input.configJson ?? {},
          sourceType: input.sourceType ?? "inline",
          sourceUrl: input.sourceUrl ?? null,
          enabled: input.enabled ?? true,
        })
        .returning();

      await createRevision(
        tx,
        layerId,
        layer.companyId,
        userId,
        [`item:${input.itemType}:${input.name}`],
        "ui",
        "Item added",
      );

      return item!;
    });
  }

  async function updateItem(
    layerId: string,
    itemId: string,
    userId: string,
    input: UpdateConfigLayerItem,
  ) {
    return db.transaction(async (tx) => {
      const layer = await tx
        .select()
        .from(configLayers)
        .where(eq(configLayers.id, layerId))
        .then((rows) => rows[0] ?? null);

      if (!layer) throw notFound("Config layer not found");

      const item = await tx
        .select()
        .from(configLayerItems)
        .where(
          and(
            eq(configLayerItems.id, itemId),
            eq(configLayerItems.layerId, layerId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!item) throw notFound("Config layer item not found");

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const changedKeys: string[] = [];

      if (input.name !== undefined && input.name !== item.name) {
        updates.name = input.name;
        changedKeys.push("name");
      }
      if (input.displayName !== undefined && input.displayName !== item.displayName) {
        updates.displayName = input.displayName;
        changedKeys.push("displayName");
      }
      if (input.description !== undefined && input.description !== item.description) {
        updates.description = input.description;
        changedKeys.push("description");
      }
      if (input.configJson !== undefined) {
        updates.configJson = input.configJson;
        changedKeys.push("configJson");
      }
      if (input.sourceType !== undefined && input.sourceType !== item.sourceType) {
        updates.sourceType = input.sourceType;
        changedKeys.push("sourceType");
      }
      if (input.sourceUrl !== undefined && input.sourceUrl !== item.sourceUrl) {
        updates.sourceUrl = input.sourceUrl;
        changedKeys.push("sourceUrl");
      }
      if (input.enabled !== undefined && input.enabled !== item.enabled) {
        updates.enabled = input.enabled;
        changedKeys.push("enabled");
      }

      if (changedKeys.length === 0) return item;

      const [updated] = await tx
        .update(configLayerItems)
        .set(updates)
        .where(eq(configLayerItems.id, itemId))
        .returning();

      await createRevision(
        tx,
        layerId,
        layer.companyId,
        userId,
        changedKeys.map((k) => `item:${item.itemType}:${item.name}:${k}`),
        "ui",
        "Item updated",
      );

      return updated!;
    });
  }

  async function removeItem(
    layerId: string,
    itemId: string,
    userId: string,
  ) {
    return db.transaction(async (tx) => {
      const layer = await tx
        .select()
        .from(configLayers)
        .where(eq(configLayers.id, layerId))
        .then((rows) => rows[0] ?? null);

      if (!layer) throw notFound("Config layer not found");

      const item = await tx
        .select()
        .from(configLayerItems)
        .where(
          and(
            eq(configLayerItems.id, itemId),
            eq(configLayerItems.layerId, layerId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!item) throw notFound("Config layer item not found");

      await tx
        .delete(configLayerItems)
        .where(eq(configLayerItems.id, itemId));

      await createRevision(
        tx,
        layerId,
        layer.companyId,
        userId,
        [`item:${item.itemType}:${item.name}:removed`],
        "ui",
        "Item removed",
      );
    });
  }

  // ─── File CRUD ───────────────────────────────────────────────────────────────

  async function addFile(
    layerId: string,
    itemId: string,
    userId: string,
    input: CreateConfigLayerFile,
  ) {
    return db.transaction(async (tx) => {
      const layer = await tx
        .select()
        .from(configLayers)
        .where(eq(configLayers.id, layerId))
        .then((rows) => rows[0] ?? null);

      if (!layer) throw notFound("Config layer not found");

      const item = await tx
        .select()
        .from(configLayerItems)
        .where(
          and(
            eq(configLayerItems.id, itemId),
            eq(configLayerItems.layerId, layerId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!item) throw notFound("Config layer item not found");

      const contentHash = sha256(input.content);

      const [file] = await tx
        .insert(configLayerFiles)
        .values({
          companyId: layer.companyId,
          itemId,
          path: input.path,
          content: input.content,
          contentHash,
        })
        .returning();

      return file!;
    });
  }

  async function removeFile(
    layerId: string,
    itemId: string,
    fileId: string,
  ) {
    await db
      .delete(configLayerFiles)
      .where(
        and(
          eq(configLayerFiles.id, fileId),
          eq(configLayerFiles.itemId, itemId),
        ),
      );
  }

  // ─── Revisions ───────────────────────────────────────────────────────────────

  async function listRevisions(layerId: string) {
    return db
      .select()
      .from(configLayerRevisions)
      .where(eq(configLayerRevisions.layerId, layerId))
      .orderBy(desc(configLayerRevisions.version));
  }

  // ─── Promotion ───────────────────────────────────────────────────────────────

  async function propose(layerId: string, userId: string) {
    return db.transaction(async (tx) => {
      const layer = await tx
        .select()
        .from(configLayers)
        .where(eq(configLayers.id, layerId))
        .then((rows) => rows[0] ?? null);

      if (!layer) throw notFound("Config layer not found");

      const snapshot = await buildSnapshot(tx, layerId);
      const contentHash = sha256(JSON.stringify(snapshot));

      const [updated] = await tx
        .update(configLayers)
        .set({
          promotionStatus: "proposed",
          promotionContentHash: contentHash,
          updatedAt: new Date(),
        })
        .where(eq(configLayers.id, layerId))
        .returning();

      await audit.emit({
        companyId: layer.companyId,
        actorId: userId,
        actorType: "user",
        action: "config_layer.promotion_proposed",
        targetType: "config_layer",
        targetId: layerId,
        metadata: { name: layer.name, contentHash },
      });

      return updated!;
    });
  }

  async function approvePromotion(
    layerId: string,
    userId: string,
    expectedContentHash: string,
  ) {
    return db.transaction(async (tx) => {
      const layer = await tx
        .select()
        .from(configLayers)
        .where(eq(configLayers.id, layerId))
        .then((rows) => rows[0] ?? null);

      if (!layer) throw notFound("Config layer not found");

      if (layer.promotionStatus !== "proposed") {
        throw badRequest("Layer is not in proposed status");
      }

      if (layer.promotionContentHash !== expectedContentHash) {
        throw conflict(
          "Content has changed since proposal. Please re-review.",
          { expected: expectedContentHash, actual: layer.promotionContentHash },
        );
      }

      const [updated] = await tx
        .update(configLayers)
        .set({
          scope: "company",
          visibility: "public",
          promotionStatus: "approved",
          updatedAt: new Date(),
        })
        .where(eq(configLayers.id, layerId))
        .returning();

      await audit.emit({
        companyId: layer.companyId,
        actorId: userId,
        actorType: "user",
        action: "config_layer.promotion_approved",
        targetType: "config_layer",
        targetId: layerId,
        metadata: { name: layer.name },
      });

      return updated!;
    });
  }

  async function rejectPromotion(
    layerId: string,
    userId: string,
    reason: string,
  ) {
    return db.transaction(async (tx) => {
      const layer = await tx
        .select()
        .from(configLayers)
        .where(eq(configLayers.id, layerId))
        .then((rows) => rows[0] ?? null);

      if (!layer) throw notFound("Config layer not found");

      if (layer.promotionStatus !== "proposed") {
        throw badRequest("Layer is not in proposed status");
      }

      const [updated] = await tx
        .update(configLayers)
        .set({
          promotionStatus: "rejected",
          updatedAt: new Date(),
        })
        .where(eq(configLayers.id, layerId))
        .returning();

      await audit.emit({
        companyId: layer.companyId,
        actorId: userId,
        actorType: "user",
        action: "config_layer.promotion_rejected",
        targetType: "config_layer",
        targetId: layerId,
        metadata: { name: layer.name, reason },
      });

      return updated!;
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  return {
    // Helpers (exposed for runtime service)
    sha256,
    buildSnapshot,
    // Layer CRUD
    createLayer,
    createBaseLayer,
    getLayer,
    listLayers,
    updateLayer,
    archiveLayer,
    // Item CRUD
    addItem,
    updateItem,
    removeItem,
    // File CRUD
    addFile,
    removeFile,
    // Revisions
    listRevisions,
    // Promotion
    propose,
    approvePromotion,
    rejectPromotion,
  };
}
