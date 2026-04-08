import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { permissions } from "./permissions.js";

export const agentPermissions = pgTable(
  "agent_permissions",
  {
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.agentId, table.permissionId] }),
  }),
);
