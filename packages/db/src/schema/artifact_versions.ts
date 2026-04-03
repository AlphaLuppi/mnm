import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { artifacts } from "./artifacts.js";
import { agents } from "./agents.js";

export const artifactVersions = pgTable(
  "artifact_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: text("content").notNull(),
    changeSummary: text("change_summary"),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    artifactVersionUq: uniqueIndex("artifact_versions_artifact_version_uq").on(
      table.artifactId,
      table.versionNumber,
    ),
    artifactCreatedIdx: index("artifact_versions_artifact_created_idx").on(
      table.artifactId,
      table.createdAt,
    ),
  }),
);
