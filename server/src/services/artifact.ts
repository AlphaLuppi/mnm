import {
  and,
  eq,
  desc,
  sql,
  count as drizzleCount,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@mnm/db";
import { artifacts, artifactVersions } from "@mnm/db";
import type { ArtifactType } from "@mnm/shared";
import { publishLiveEvent } from "./live-events.js";

export function artifactService(db: Db) {
  return {
    async create(
      companyId: string,
      input: {
        title: string;
        artifactType?: string;
        language?: string | null;
        content: string;
        sourceChannelId?: string | null;
        sourceMessageId?: string | null;
        metadata?: Record<string, unknown>;
      },
      creatorInfo: { userId?: string; agentId?: string },
    ) {
      return db.transaction(async (tx) => {
        const [artifact] = await tx
          .insert(artifacts)
          .values({
            companyId,
            title: input.title,
            artifactType: input.artifactType ?? "markdown",
            language: input.language ?? null,
            sourceChannelId: input.sourceChannelId ?? null,
            sourceMessageId: input.sourceMessageId ?? null,
            createdByUserId: creatorInfo.userId ?? null,
            createdByAgentId: creatorInfo.agentId ?? null,
            metadata: input.metadata ?? null,
          })
          .returning();

        const [version] = await tx
          .insert(artifactVersions)
          .values({
            artifactId: artifact!.id,
            versionNumber: 1,
            content: input.content,
            changeSummary: "Initial version",
            createdByUserId: creatorInfo.userId ?? null,
            createdByAgentId: creatorInfo.agentId ?? null,
          })
          .returning();

        const [updated] = await tx
          .update(artifacts)
          .set({ currentVersionId: version!.id })
          .where(eq(artifacts.id, artifact!.id))
          .returning();

        publishLiveEvent({
          companyId,
          type: "artifact.created",
          payload: {
            artifactId: updated!.id,
            title: updated!.title,
            artifactType: updated!.artifactType,
            visibility: { scope: "company-wide" },
          },
        });

        return { ...updated!, currentVersion: version! };
      });
    },

    async getById(companyId: string, artifactId: string) {
      const rows = await db
        .select({
          artifact: artifacts,
          version: artifactVersions,
        })
        .from(artifacts)
        .leftJoin(
          artifactVersions,
          eq(artifacts.currentVersionId, artifactVersions.id),
        )
        .where(
          and(eq(artifacts.id, artifactId), eq(artifacts.companyId, companyId)),
        );

      const row = rows[0];
      if (!row) return null;

      return {
        ...row.artifact,
        currentVersion: row.version ?? undefined,
      };
    },

    async list(
      companyId: string,
      opts?: {
        channelId?: string;
        artifactType?: string;
        createdByUserId?: string;
        limit?: number;
        offset?: number;
      },
    ) {
      const conditions: SQL[] = [eq(artifacts.companyId, companyId)];

      if (opts?.channelId) {
        conditions.push(eq(artifacts.sourceChannelId, opts.channelId));
      }
      if (opts?.artifactType) {
        conditions.push(eq(artifacts.artifactType, opts.artifactType));
      }
      if (opts?.createdByUserId) {
        conditions.push(eq(artifacts.createdByUserId, opts.createdByUserId));
      }

      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;

      const [rows, totalResult] = await Promise.all([
        db
          .select({
            artifact: artifacts,
            version: artifactVersions,
          })
          .from(artifacts)
          .leftJoin(
            artifactVersions,
            eq(artifacts.currentVersionId, artifactVersions.id),
          )
          .where(and(...conditions))
          .orderBy(desc(artifacts.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: drizzleCount() })
          .from(artifacts)
          .where(and(...conditions)),
      ]);

      const artifactsList = rows.map((row) => ({
        ...row.artifact,
        currentVersion: row.version ?? undefined,
      }));

      return {
        artifacts: artifactsList,
        total: Number(totalResult[0]?.count ?? 0),
      };
    },

    async update(
      companyId: string,
      artifactId: string,
      input: {
        title?: string;
        content?: string;
        changeSummary?: string;
        language?: string | null;
        metadata?: Record<string, unknown>;
      },
      creatorInfo: { userId?: string; agentId?: string },
    ) {
      return db.transaction(async (tx) => {
        // Verify artifact exists and belongs to company
        const existing = await tx
          .select()
          .from(artifacts)
          .where(
            and(
              eq(artifacts.id, artifactId),
              eq(artifacts.companyId, companyId),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!existing) return null;

        let newVersion = null;

        if (input.content) {
          // Get next version number
          const maxResult = await tx
            .select({
              maxVersion: sql<number>`COALESCE(MAX(${artifactVersions.versionNumber}), 0)`,
            })
            .from(artifactVersions)
            .where(eq(artifactVersions.artifactId, artifactId));

          const nextVersion = Number(maxResult[0]?.maxVersion ?? 0) + 1;

          const [version] = await tx
            .insert(artifactVersions)
            .values({
              artifactId,
              versionNumber: nextVersion,
              content: input.content,
              changeSummary: input.changeSummary ?? null,
              createdByUserId: creatorInfo.userId ?? null,
              createdByAgentId: creatorInfo.agentId ?? null,
            })
            .returning();

          newVersion = version!;
        }

        const updates: Record<string, unknown> = {
          updatedAt: new Date(),
        };
        if (input.title !== undefined) {
          updates.title = input.title;
        }
        if (input.language !== undefined) {
          updates.language = input.language;
        }
        if (input.metadata !== undefined) {
          updates.metadata = input.metadata;
        }
        if (newVersion) {
          updates.currentVersionId = newVersion.id;
        }

        const [updated] = await tx
          .update(artifacts)
          .set(updates)
          .where(eq(artifacts.id, artifactId))
          .returning();

        publishLiveEvent({
          companyId,
          type: "artifact.updated",
          payload: {
            artifactId: updated!.id,
            title: updated!.title,
            versionNumber: newVersion?.versionNumber ?? null,
            visibility: { scope: "company-wide" },
          },
        });

        return {
          ...updated!,
          currentVersion: newVersion ?? undefined,
        };
      });
    },

    async delete(companyId: string, artifactId: string) {
      const deleted = await db
        .delete(artifacts)
        .where(
          and(
            eq(artifacts.id, artifactId),
            eq(artifacts.companyId, companyId),
          ),
        )
        .returning();

      if (deleted.length > 0) {
        publishLiveEvent({
          companyId,
          type: "artifact.deleted",
            visibility: { scope: "company-wide" },
          payload: { artifactId },
        });
      }
    },

    async getVersions(
      companyId: string,
      artifactId: string,
      opts?: { limit?: number; offset?: number },
    ) {
      // Verify artifact belongs to company
      const existing = await db
        .select({ id: artifacts.id })
        .from(artifacts)
        .where(
          and(
            eq(artifacts.id, artifactId),
            eq(artifacts.companyId, companyId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!existing) return null;

      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;

      const versions = await db
        .select()
        .from(artifactVersions)
        .where(eq(artifactVersions.artifactId, artifactId))
        .orderBy(desc(artifactVersions.versionNumber))
        .limit(limit)
        .offset(offset);

      return versions;
    },

    async getVersion(
      companyId: string,
      artifactId: string,
      versionId: string,
    ) {
      // Verify artifact belongs to company
      const existing = await db
        .select({ id: artifacts.id })
        .from(artifacts)
        .where(
          and(
            eq(artifacts.id, artifactId),
            eq(artifacts.companyId, companyId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!existing) return null;

      const version = await db
        .select()
        .from(artifactVersions)
        .where(
          and(
            eq(artifactVersions.id, versionId),
            eq(artifactVersions.artifactId, artifactId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      return version;
    },

    detectType(content: string): ArtifactType {
      // Contains triple backtick → code
      if (content.includes("```")) return "code";

      // Valid JSON → code (structured data)
      try {
        JSON.parse(content);
        return "code";
      } catch {
        // not JSON
      }

      // Contains | pipes in column pattern → spreadsheet
      const lines = content.split("\n");
      const pipeLines = lines.filter(
        (line) => line.includes("|") && line.trim().startsWith("|"),
      );
      if (pipeLines.length >= 2) return "spreadsheet";

      // Contains # headers → markdown
      if (/^#{1,6}\s/m.test(content)) return "markdown";

      // Contains HTML tags → html
      if (/<[a-z][\s\S]*>/i.test(content)) return "html";

      // Fallback → markdown
      return "markdown";
    },
  };
}
