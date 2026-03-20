import { relations } from "drizzle-orm";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { containerProfiles } from "./container_profiles.js";
import { containerInstances } from "./container_instances.js";

// cont-s05-profiles-relations
export const containerProfilesRelations = relations(containerProfiles, ({ one, many }) => ({
  company: one(companies, {
    fields: [containerProfiles.companyId],
    references: [companies.id],
  }),
  instances: many(containerInstances),
}));

// cont-s05-instances-relations
export const containerInstancesRelations = relations(containerInstances, ({ one }) => ({
  company: one(companies, {
    fields: [containerInstances.companyId],
    references: [companies.id],
  }),
  profile: one(containerProfiles, {
    fields: [containerInstances.profileId],
    references: [containerProfiles.id],
  }),
  agent: one(agents, {
    fields: [containerInstances.agentId],
    references: [agents.id],
  }),
}));
