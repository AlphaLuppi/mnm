import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatChannels } from "./chat_channels.js";
import { chatMessages } from "./chat_messages.js";
import { agents } from "./agents.js";

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    title: text("title").notNull(),
    artifactType: text("artifact_type").notNull().default("markdown"),
    language: text("language"),
    currentVersionId: uuid("current_version_id"),
    sourceChannelId: uuid("source_channel_id").references(() => chatChannels.id, { onDelete: "set null" }),
    sourceMessageId: uuid("source_message_id").references(() => chatMessages.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("artifacts_company_created_idx").on(table.companyId, table.createdAt),
    companyTypeIdx: index("artifacts_company_type_idx").on(table.companyId, table.artifactType),
    sourceChannelIdx: index("artifacts_source_channel_idx").on(table.sourceChannelId),
  }),
);
